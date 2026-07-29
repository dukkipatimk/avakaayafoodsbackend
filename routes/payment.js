const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Order, OrderItem, OrderStatusHistory, LeadSession } = require('../models');
const { optionalAuth } = require('../middleware/auth');
const { sendEmail, orderConfirmationEmail } = require('../utils/email');
const { sendWhatsAppTemplate, orderConfirmedTemplate, newOrderTemplate } = require('../utils/whatsapp');
const { trackInteraktEvent } = require('../utils/interakt');
const icici = require('../utils/icici');

// Fire customer + admin notifications after payment is confirmed.
// Idempotent at the caller — we just don't track sent state here. Failures are swallowed.
async function notifyOrderPaid(orderId) {
  try {
    await LeadSession.update({ status: 'converted' }, { where: { orderId } });
    const fullOrder = await Order.findByPk(orderId, {
      include: [{ model: OrderItem, as: 'items' }],
    });
    if (!fullOrder) return;

    const addr = fullOrder.shippingAddress || {};
    const customerEmail = fullOrder.guestEmail || addr.email;
    const customerPhone = addr.phone;
    // New-order emails go to ORDERS_EMAIL; falls back to ADMIN_EMAIL if unset.
    const adminEmail = process.env.ORDERS_EMAIL || process.env.ADMIN_EMAIL;
    const adminPhone = process.env.ADMIN_PHONE;

    const subj = `Order Confirmed #${fullOrder.orderNumber}`;
    const html = orderConfirmationEmail(fullOrder);

    if (customerEmail) sendEmail({ to: customerEmail, subject: subj, html }).catch(() => {});
    if (adminEmail)    sendEmail({ to: adminEmail, subject: `[NEW ORDER] ${subj}`, html }).catch(() => {});

    if (customerPhone) {
      sendWhatsAppTemplate({ phone: customerPhone, country: addr.country, ...orderConfirmedTemplate(fullOrder) })
        .catch((e) => console.error('WhatsApp (customer) failed:', e.message));
    }
    if (adminPhone) {
      sendWhatsAppTemplate({ phone: adminPhone, country: 'India', ...newOrderTemplate(fullOrder) })
        .catch((e) => console.error('WhatsApp (admin) failed:', e.message));
    }

    // Push an "Order Placed" event to Interakt for post-purchase campaigns.
    if (customerPhone) {
      const itemsList = (fullOrder.items || [])
        .map((i) => `${i.name} (${i.variantWeight || ''}) x${i.quantity}`)
        .join(', ');
      trackInteraktEvent({
        phone: customerPhone,
        country: addr.country,
        name: addr.fullName,
        email: customerEmail,
        event: process.env.INTERAKT_EVENT_ORDER_PLACED || 'Order Placed',
        traits: {
          orderNumber: fullOrder.orderNumber,
          amount: Number(fullOrder.total) || 0,
          currency: fullOrder.currency || 'INR',
          paymentStatus: fullOrder.paymentStatus,
          paymentMethod: fullOrder.paymentMethod,
          itemCount: (fullOrder.items || []).length,
          items: itemsList || 'your items',
          city: addr.city || '',
          state: addr.state || '',
        },
      }).catch((e) => console.error('Interakt (order placed) failed:', e.message));
    }
  } catch (e) {
    console.error('notifyOrderPaid error:', e.message);
  }
}

// Billing fields for the payment gateway. Falls back to the shipping address
// when no separate billing address was captured on the order.
const trimField = (v) => String(v == null ? '' : v).slice(0, 250);
function billingFieldsFromOrder(order) {
  const b = order.billingAddress || order.shippingAddress || {};
  return {
    billing_name:    trimField(b.fullName || b.name),
    billing_address: trimField([b.line1, b.line2].filter(Boolean).join(', ')),
    billing_city:    trimField(b.city),
    billing_state:   trimField(b.state),
    billing_zip:     trimField(b.pincode),
    billing_country: trimField(b.country),
    billing_tel:     trimField(b.phone),
    billing_email:   trimField(b.email),
  };
}
function deliveryFieldsFromOrder(order) {
  const d = order.shippingAddress || {};
  return {
    delivery_name:    trimField(d.fullName || d.name),
    delivery_address: trimField([d.line1, d.line2].filter(Boolean).join(', ')),
    delivery_city:    trimField(d.city),
    delivery_state:   trimField(d.state),
    delivery_zip:     trimField(d.pincode),
    delivery_country: trimField(d.country),
    delivery_tel:     trimField(d.phone),
  };
}

const isRealKey = (k) => k && k.startsWith('rzp_');
let Razorpay;
const getRazorpay = () => {
  if (!Razorpay && isRealKey(process.env.RAZORPAY_KEY_ID)) {
    const RazorpayLib = require('razorpay');
    Razorpay = new RazorpayLib({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return Razorpay;
};

// Ensure an authorized Razorpay payment is actually CAPTURED (money collected).
// Without this, payments stay "authorized" and auto-refund after a few days if
// the account isn't set to auto-capture. Idempotent: only captures when the
// payment is still in the 'authorized' state; never throws to the caller.
async function captureRazorpayPayment(paymentId) {
  const rzp = getRazorpay();
  if (!rzp || !paymentId || String(paymentId).startsWith('mock')) return;
  try {
    const pay = await rzp.payments.fetch(paymentId);
    if (pay && pay.status === 'authorized') {
      await rzp.payments.capture(paymentId, pay.amount, pay.currency || 'INR');
      console.log(`Razorpay payment ${paymentId} captured (${pay.currency} ${pay.amount / 100})`);
    }
  } catch (e) {
    console.error(`Razorpay capture failed for ${paymentId}:`, e?.error?.description || e.message);
  }
}

// @POST /api/payment/create-order
router.post('/create-order', optionalAuth, async (req, res) => {
  try {
    const { orderId, amount, currency = 'INR' } = req.body;

    const paise = Math.round(Number(amount) * 100);
    if (!Number.isFinite(paise) || paise < 100) {
      return res.status(400).json({ success: false, message: 'amount must be ≥ ₹1 (100 paise)' });
    }

    const rzp = getRazorpay();
    if (!rzp) {
      return res.json({
        success: true,
        order: { id: 'order_mock_' + Date.now(), amount: paise, currency },
        keyId: 'rzp_test_mock',
        mock:  true,
      });
    }
    // Carry the billing address (or shipping fallback) into the Razorpay notes
    // so it travels with the payment record.
    const dbOrder = await Order.findByPk(orderId).catch(() => null);
    const notes = { orderId: String(orderId) };
    if (dbOrder) Object.assign(notes, billingFieldsFromOrder(dbOrder));

    const order = await rzp.orders.create({
      amount:  paise,
      currency,
      receipt: `AKF_${orderId}`,
      notes,
    });
    // Persist the razorpay_order_id so the callback / webhook can look up our Order by it
    await Order.update({ razorpayOrderId: order.id }, { where: { id: orderId } }).catch(() => {});
    res.json({ success: true, order, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    const status = err?.statusCode === 401 ? 401 : 500;
    res.status(status).json({ success: false, message: err.message || 'Razorpay error' });
  }
});

// @POST /api/payment/verify
router.post('/verify', optionalAuth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing required payment fields' });
    }

    if (razorpay_order_id?.startsWith('order_mock_')) {
      await Order.update(
        { paymentStatus: 'paid', paymentId: 'mock_payment_' + Date.now(), orderStatus: 'confirmed' },
        { where: { id: orderId } }
      );
      await OrderStatusHistory.create({ orderId, status: 'confirmed', note: 'Payment received (mock)' });
      notifyOrderPaid(orderId);
      return res.json({ success: true, message: 'Payment verified (mock mode)' });
    }

    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (expected !== razorpay_signature)
      return res.status(400).json({ success: false, message: 'Payment verification failed' });

    // Capture the funds (no-op if already captured / auto-captured)
    await captureRazorpayPayment(razorpay_payment_id);

    await Order.update(
      { paymentStatus: 'paid', paymentId: razorpay_payment_id, razorpayOrderId: razorpay_order_id, orderStatus: 'confirmed' },
      { where: { id: orderId } }
    );
    await OrderStatusHistory.create({ orderId, status: 'confirmed', note: 'Payment received via Razorpay/ICICI' });
    notifyOrderPaid(orderId);

    res.json({ success: true, message: 'Payment verified successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── ICICI Bank Payment Gateway (Orange PG) — Standard/Redirect (payType=0) ──
// @POST /api/payment/icici/initiate  { orderId }
// Server-to-server initiateSale, then hand the browser a redirect URL.
router.post('/icici/initiate', optionalAuth, async (req, res) => {
  try {
    // ICICI PG is restricted to admins for now. Remove this guard to open it to
    // all customers (the checkout UI gate on `isAdmin` should be lifted too).
    if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'ICICI payment is currently available to admin users only.' });
    }
    const { orderId } = req.body;
    if (!icici.configured()) {
      return res.json({ success: true, mock: true, redirectUrl: `/order/success?orderId=${orderId}`,
        message: 'ICICI gateway not configured. Using mock mode.' });
    }
    const order = await Order.findByPk(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const addr = order.shippingAddress || {};
    const params = icici.buildSaleRequest({
      orderId: order.id, amount: order.total,
      email: order.guestEmail || addr.email, phone: addr.phone, name: addr.fullName || addr.name,
    });
    const r = await icici.initiateSale(params);
    const j = r.json;
    if (!j || j.responseCode !== 'R1000' || !j.redirectURI || !j.tranCtx) {
      console.error('ICICI initiateSale failed:', r.status, (r.raw || '').slice(0, 300));
      return res.status(502).json({ success: false, code: j?.responseCode,
        message: j?.responseDescription || j?.respDescription || 'Could not start ICICI payment' });
    }
    // Persist the merchant txn ref so the async response can map back to this order.
    await order.update({
      paymentMethod: 'icici',
      razorpayOrderId: params.merchantTxnNo,   // reused as the gateway txn reference
      notes: [order.notes, `ICICI txnNo=${params.merchantTxnNo} tranCtx=${j.tranCtx}`].filter(Boolean).join('\n'),
    });
    const sep = j.redirectURI.includes('?') ? '&' : '?';
    res.json({ success: true, merchantTxnNo: params.merchantTxnNo,
      paymentUrl: `${j.redirectURI}${sep}tranCtx=${encodeURIComponent(j.tranCtx)}` });
  } catch (err) {
    console.error('ICICI initiate error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Shared logic for the browser return (returnURL) and the server-to-server
// Payment Advice: verify secureHash, then mark the order paid/failed (idempotent).
async function applyIciciResult(params) {
  if (!params || !Object.keys(params).length) return { order: null, reason: 'empty' };
  let order = params.merchantTxnNo ? await Order.findOne({ where: { razorpayOrderId: params.merchantTxnNo } }) : null;
  if (!order && params.addlParam1) order = await Order.findByPk(params.addlParam1).catch(() => null);
  if (!order) return { order: null, reason: 'order_not_found' };

  if (!icici.verifyHash(params)) {
    console.error(`ICICI hash mismatch for order ${order.id} (txnNo ${params.merchantTxnNo})`);
    return { order, verified: false, reason: 'invalid_signature' };
  }
  const success = icici.isSuccessCode(String(params.responseCode || ''));
  if (success) {
    if (order.paymentStatus !== 'paid') {
      await order.update({ paymentStatus: 'paid', orderStatus: 'confirmed',
        paymentId: params.paymentId || params.txnID || params.txnAuthID || order.paymentId });
      await OrderStatusHistory.create({ orderId: order.id, status: 'confirmed',
        note: `Payment received via ICICI PG (txnID ${params.txnID || '-'}, ${params.paymentMode || 'online'})` });
      notifyOrderPaid(order.id);
    }
  } else if (order.paymentStatus !== 'paid') {
    await order.update({ paymentStatus: 'failed' });
    await OrderStatusHistory.create({ orderId: order.id, status: order.orderStatus,
      note: `ICICI payment failed: ${params.respDescription || params.responseCode || 'unknown'}` });
  }
  return { order, verified: true, success };
}

// @POST /api/payment/icici/response — returnURL; ICICI browser-POSTs the result here.
router.post('/icici/response', async (req, res) => {
  const frontend = process.env.FRONTEND_URL || 'https://avakaayafoods.com';
  try {
    const r = await applyIciciResult(req.body || {});
    if (!r.order) return res.redirect(`${frontend}/checkout/failed?reason=${encodeURIComponent(r.reason || 'error')}`);
    if (r.verified === false) return res.redirect(`${frontend}/checkout/failed?orderId=${r.order.id}&reason=invalid_signature`);
    if (r.success) return res.redirect(`${frontend}/order/success?orderId=${r.order.id}&orderNumber=${encodeURIComponent(r.order.orderNumber || '')}`);
    return res.redirect(`${frontend}/checkout/failed?orderId=${r.order.id}&reason=${encodeURIComponent(req.body?.respDescription || 'payment_failed')}`);
  } catch (err) {
    console.error('ICICI response error:', err);
    res.redirect(`${frontend}/checkout/failed?reason=server_error`);
  }
});

// @POST /api/payment/icici/advice — server-to-server Payment Advice (fallback).
router.post('/icici/advice', async (req, res) => {
  try { await applyIciciResult(req.body || {}); } catch (e) { console.error('ICICI advice error:', e.message); }
  res.json({ ok: true });   // any HTTP 200 is treated as delivered
});

// @POST /api/payment/icici/status  { orderId }  — reconcile via Transaction Status.
router.post('/icici/status', optionalAuth, async (req, res) => {
  try {
    const order = await Order.findByPk(req.body.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    const mtxn = order.razorpayOrderId;
    if (!mtxn) return res.status(400).json({ success: false, message: 'No ICICI transaction on this order' });
    const r = await icici.txnStatus({ merchantTxnNo: mtxn, originalTxnNo: mtxn });
    const j = r.json || {};
    if (j.txnStatus === 'SUC' && icici.isSuccessCode(String(j.txnResponseCode || '')) && order.paymentStatus !== 'paid') {
      await order.update({ paymentStatus: 'paid', orderStatus: 'confirmed', paymentId: j.txnAuthID || j.txnID || order.paymentId });
      await OrderStatusHistory.create({ orderId: order.id, status: 'confirmed', note: `Payment confirmed via ICICI status check (txnID ${j.txnID || '-'})` });
      notifyOrderPaid(order.id);
    }
    res.json({ success: true, txnStatus: j.txnStatus, paymentStatus: order.paymentStatus });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/payment/callback — Razorpay redirect-mode callback
// Razorpay POSTs (form-urlencoded) razorpay_payment_id, razorpay_order_id,
// razorpay_signature here when the customer's checkout returns via redirect.
// We verify the signature and 302-redirect them to the success or failed page.
router.post('/callback', async (req, res) => {
  const frontend = process.env.FRONTEND_URL || 'https://mediumspringgreen-sparrow-932682.hostingersite.com';
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, error_code, error_description } = req.body;

    if (error_code) {
      return res.redirect(`${frontend}/checkout/failed?reason=${encodeURIComponent(error_description || error_code)}`);
    }

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.redirect(`${frontend}/checkout/failed?reason=missing_fields`);
    }

    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return res.redirect(`${frontend}/checkout/failed?reason=invalid_signature`);
    }

    // Capture the funds (no-op if already captured / auto-captured)
    await captureRazorpayPayment(razorpay_payment_id);

    // Resolve our Order from razorpay_order_id (saved at create-order time)
    const order = await Order.findOne({ where: { razorpayOrderId: razorpay_order_id } });
    if (!order) {
      return res.redirect(`${frontend}/checkout/failed?reason=order_not_found`);
    }

    if (order.paymentStatus !== 'paid') {
      await order.update({
        paymentStatus: 'paid',
        paymentId: razorpay_payment_id,
        orderStatus: 'confirmed',
      });
      await OrderStatusHistory.create({
        orderId: order.id,
        status: 'confirmed',
        note: 'Payment captured via Razorpay redirect callback',
      });
      notifyOrderPaid(order.id);
    }

    return res.redirect(
      `${frontend}/order/success?orderId=${order.id}&orderNumber=${encodeURIComponent(order.orderNumber || '')}`
    );
  } catch (err) {
    console.error('Razorpay callback error:', err);
    return res.redirect(`${frontend}/checkout/failed?reason=server_error`);
  }
});

// @POST /api/payment/webhook — Razorpay webhook (idempotent fallback)
// Razorpay calls this from its servers regardless of whether the user's browser
// returned to our site. Configure URL + secret in Razorpay dashboard.
router.post('/webhook', async (req, res) => {
  try {
    const secret    = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    if (!secret) return res.status(503).json({ ok: false, message: 'Webhook secret not configured' });
    if (!signature || !req.rawBody) return res.status(400).json({ ok: false });

    const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
    if (expected !== signature) {
      return res.status(401).json({ ok: false, message: 'Invalid signature' });
    }

    const event = req.body?.event;
    const payment = req.body?.payload?.payment?.entity;
    if (!payment) return res.json({ ok: true });

    // Resolve our Order. Prefer payment.notes.orderId, but Razorpay does NOT copy
    // the *order's* notes onto the *payment* entity, so notes is usually empty
    // here — fall back to the razorpay order id (saved on our Order at
    // create-order time). Without this the webhook can never mark the order paid,
    // so paid orders whose browser never hit /verify stay unpaid and their lead
    // never converts (and may get an "abandoned cart" alert despite paying).
    const notesOrderId = payment.notes?.orderId;
    let order = notesOrderId ? await Order.findByPk(notesOrderId) : null;
    if (!order && payment.order_id) {
      order = await Order.findOne({ where: { razorpayOrderId: payment.order_id } });
    }
    if (!order) {
      console.warn(`[WEBHOOK] ${event}: could not resolve order (notes.orderId=${notesOrderId}, rzpOrderId=${payment.order_id})`);
      return res.json({ ok: true });
    }
    console.log(`[WEBHOOK] ${event} → order ${order.orderNumber} (id ${order.id})`);

    if (event === 'payment.captured' || event === 'payment.authorized') {
      // If Razorpay only authorized (didn't auto-capture), capture it now.
      if (event === 'payment.authorized') {
        await captureRazorpayPayment(payment.id);
      }
      if (order.paymentStatus !== 'paid') {
        await order.update({
          paymentStatus: 'paid',
          paymentId: payment.id,
          razorpayOrderId: payment.order_id,
          orderStatus: 'confirmed',
        });
        await OrderStatusHistory.create({
          orderId: order.id, status: 'confirmed',
          note: `Payment captured via Razorpay webhook (${payment.method || 'unknown'})`,
        });
        notifyOrderPaid(order.id);
      }
    } else if (event === 'payment.failed') {
      if (order.paymentStatus !== 'paid') {
        await order.update({ paymentStatus: 'failed' });
        await OrderStatusHistory.create({
          orderId: order.id, status: order.orderStatus,
          note: `Payment failed: ${payment.error_description || 'unknown'}`,
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Razorpay webhook error:', err);
    res.status(500).json({ ok: false });
  }
});

// @POST /api/payment/upi/initiate — direct UPI (no gateway)
// Builds a UPI deep-link + QR for the customer's UPI app. Stateless: nothing
// is paid yet. Funds land in the merchant's bank; admin verifies before fulfilment.
router.post('/upi/initiate', optionalAuth, async (req, res) => {
  try {
    const { orderId, amount } = req.body;
    const order = await Order.findByPk(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const vpa        = process.env.UPI_VPA;
    const payeeName  = process.env.UPI_PAYEE_NAME || 'Avakaaya Foods';
    if (!vpa) {
      return res.status(500).json({ success: false, message: 'UPI VPA not configured on server' });
    }

    const reference = `AKF${order.orderNumber || order.id}`;
    const note      = `Order ${order.orderNumber || order.id}`;
    const amt       = Number(amount ?? order.total).toFixed(2);

    const params = new URLSearchParams({
      pa: vpa,
      pn: payeeName,
      am: amt,
      cu: 'INR',
      tn: note,
      tr: reference,
    });
    const upiUrl   = `upi://pay?${params.toString()}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(upiUrl)}`;

    res.json({
      success: true,
      upiUrl,
      qrCodeUrl,
      vpa,
      payeeName,
      amount: amt,
      reference,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/payment/upi/claim — customer claims they paid via UPI
// Stores their UPI transaction reference. Payment stays 'pending' until an
// admin verifies the bank statement and marks the order paid.
router.post('/upi/claim', optionalAuth, async (req, res) => {
  try {
    const { orderId, upiTxnRef, payerVpa } = req.body;
    if (!orderId || !upiTxnRef) {
      return res.status(400).json({ success: false, message: 'orderId and upiTxnRef required' });
    }
    const order = await Order.findByPk(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    await order.update({
      paymentMethod: 'upi',
      paymentId: upiTxnRef,
      notes: [order.notes, `UPI claim: txn=${upiTxnRef}${payerVpa ? ` from=${payerVpa}` : ''}`]
        .filter(Boolean).join('\n'),
    });
    await OrderStatusHistory.create({
      orderId,
      status: order.orderStatus,
      note: `Customer claims UPI payment (txn ref: ${upiTxnRef}) — awaiting admin verification`,
    });

    res.json({ success: true, message: 'Payment claim recorded. Order will be confirmed after verification.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
