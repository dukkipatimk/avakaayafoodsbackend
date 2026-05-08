const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Order, OrderStatusHistory } = require('../models');
const { optionalAuth } = require('../middleware/auth');

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

// @POST /api/payment/create-order
router.post('/create-order', optionalAuth, async (req, res) => {
  try {
    const { orderId, amount, currency = 'INR' } = req.body;
    const rzp = getRazorpay();
    if (!rzp) {
      return res.json({
        success: true,
        order: { id: 'order_mock_' + Date.now(), amount: amount * 100, currency },
        keyId: 'rzp_test_mock',
        mock:  true,
      });
    }
    const order = await rzp.orders.create({
      amount:  Math.round(amount * 100),
      currency,
      receipt: `AKF_${orderId}`,
      notes:   { orderId },
    });
    res.json({ success: true, order, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/payment/verify
router.post('/verify', optionalAuth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    if (razorpay_order_id?.startsWith('order_mock_')) {
      await Order.update(
        { paymentStatus: 'paid', paymentId: 'mock_payment_' + Date.now(), orderStatus: 'confirmed' },
        { where: { id: orderId } }
      );
      await OrderStatusHistory.create({ orderId, status: 'confirmed', note: 'Payment received (mock)' });
      return res.json({ success: true, message: 'Payment verified (mock mode)' });
    }

    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (expected !== razorpay_signature)
      return res.status(400).json({ success: false, message: 'Payment verification failed' });

    await Order.update(
      { paymentStatus: 'paid', paymentId: razorpay_payment_id, razorpayOrderId: razorpay_order_id, orderStatus: 'confirmed' },
      { where: { id: orderId } }
    );
    await OrderStatusHistory.create({ orderId, status: 'confirmed', note: 'Payment received via Razorpay/ICICI' });

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

    const orderParams = new URLSearchParams({
      merchant_id: merchantId, order_id: orderId, amount: amount.toFixed(2), currency: 'INR',
      redirect_url: process.env.ICICI_REDIRECT_URL, cancel_url: process.env.ICICI_CANCEL_URL,
      billing_email: customerEmail, billing_tel: customerPhone, language: 'EN',
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
      return res.redirect(`${process.env.FRONTEND_URL}/order/success?orderId=${orderId}`);
    }

    res.redirect(`${process.env.FRONTEND_URL}/checkout/failed?orderId=${orderId}`);
  } catch (err) {
    res.redirect(`${process.env.FRONTEND_URL}/checkout/failed`);
  }
});

module.exports = router;
