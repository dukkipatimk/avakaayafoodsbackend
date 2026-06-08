const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Order, OrderItem, OrderStatusHistory, LeadSession } = require('../models');
const { optionalAuth } = require('../middleware/auth');
const { sendEmail, orderConfirmationEmail } = require('../utils/email');
const { sendWhatsAppTemplate, orderConfirmedTemplate, newOrderTemplate } = require('../utils/whatsapp');
const { trackInteraktEvent } = require('../utils/interakt');

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

// @POST /api/payment/icici/initiate
router.post('/icici/initiate', optionalAuth, async (req, res) => {
  try {
    const { orderId, amount, customerEmail, customerPhone } = req.body;
    const merchantId = process.env.ICICI_MERCHANT_ID;
    const workingKey = process.env.ICICI_WORKING_KEY;
    const accessCode = process.env.ICICI_ACCESS_CODE;

    if (!merchantId) {
      return res.json({
        success: true, mock: true,
        redirectUrl: `/order/success?orderId=${orderId}`,
        message: 'ICICI payment gateway not configured. Using mock mode.',
      });
    }

    // Pull the billing address (or shipping fallback) and the delivery address
    // off the order so CCAvenue gets a complete billing + delivery address.
    const dbOrder = await Order.findByPk(orderId).catch(() => null);
    const billing = dbOrder ? billingFieldsFromOrder(dbOrder) : {};
    const delivery = dbOrder ? deliveryFieldsFromOrder(dbOrder) : {};

    const orderParams = new URLSearchParams({
      merchant_id: merchantId, order_id: orderId, amount: amount.toFixed(2), currency: 'INR',
      redirect_url: process.env.ICICI_REDIRECT_URL, cancel_url: process.env.ICICI_CANCEL_URL,
      language: 'EN',
      ...billing,
      // explicit body values win over the address-derived ones when present
      billing_email: customerEmail || billing.billing_email || '',
      billing_tel:   customerPhone || billing.billing_tel || '',
      ...delivery,
    }).toString();

    const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(workingKey.substring(0, 16)), Buffer.alloc(16, 0));
    let encrypted = cipher.update(orderParams, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    res.json({
      success: true, encRequest: encrypted, accessCode,
      paymentUrl: 'https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/payment/icici/response
router.post('/icici/response', async (req, res) => {
  try {
    const { encResp } = req.body;
    const workingKey  = process.env.ICICI_WORKING_KEY;
    if (!workingKey) return res.redirect(`${process.env.FRONTEND_URL}/order/success`);

    const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from(workingKey.substring(0, 16)), Buffer.alloc(16, 0));
    let decrypted  = decipher.update(encResp, 'hex', 'utf8');
    decrypted     += decipher.final('utf8');

    const params      = new URLSearchParams(decrypted);
    const orderId     = params.get('order_id');
    const orderStatus = params.get('order_status');

    if (orderStatus === 'Success') {
      await Order.update(
        { paymentStatus: 'paid', paymentId: params.get('tracking_id'), orderStatus: 'confirmed' },
        { where: { id: orderId } }
      );
      notifyOrderPaid(orderId);
      return res.redirect(`${process.env.FRONTEND_URL}/order/success?orderId=${orderId}`);
    }

    res.redirect(`${process.env.FRONTEND_URL}/checkout/failed?orderId=${orderId}`);
  } catch (err) {
    res.redirect(`${process.env.FRONTEND_URL}/checkout/failed`);
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

    const orderId = payment.notes?.orderId;
    if (!orderId) return res.json({ ok: true });

    const order = await Order.findByPk(orderId);
    if (!order) return res.json({ ok: true });

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
