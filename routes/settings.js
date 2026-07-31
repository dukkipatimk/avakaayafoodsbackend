const express = require('express');
const router = express.Router();
const { Setting } = require('../models');
const { protect, superAdminOnly } = require('../middleware/auth');

const PAYMENT_KEY = 'paymentMethods';
// Customer-facing checkout methods. Online gateways on by default.
// `icici` = ICICI Bank Payment Gateway (redirect, accepts international cards).
const PAYMENT_DEFAULTS = { icici: true, razorpay: true, cod: false, upi: false };

async function getPaymentMethods() {
  const row = await Setting.findOne({ where: { key: PAYMENT_KEY } });
  return { ...PAYMENT_DEFAULTS, ...(row?.value || {}) };
}

// @GET /api/settings/payment-methods — public (checkout reads enabled methods)
router.get('/payment-methods', async (req, res) => {
  try {
    res.json({ success: true, methods: await getPaymentMethods() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PUT /api/settings/payment-methods — super admin: enable/disable methods
router.put('/payment-methods', protect, superAdminOnly, async (req, res) => {
  try {
    const incoming = req.body && typeof req.body === 'object' ? req.body : {};
    const next = { ...PAYMENT_DEFAULTS };
    for (const key of Object.keys(PAYMENT_DEFAULTS)) {
      if (typeof incoming[key] === 'boolean') next[key] = incoming[key];
    }
    // Never let the admin disable every method — keep at least one on.
    if (!Object.values(next).some(Boolean)) {
      return res.status(400).json({ success: false, message: 'At least one payment method must stay enabled.' });
    }
    const [row] = await Setting.findOrCreate({ where: { key: PAYMENT_KEY }, defaults: { value: next } });
    await row.update({ value: next });
    res.json({ success: true, methods: next });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
module.exports.getPaymentMethods = getPaymentMethods;
