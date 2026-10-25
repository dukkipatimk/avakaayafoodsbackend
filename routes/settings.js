const express = require('express');
const router = express.Router();
const { Setting, Product } = require('../models');
const { protect, adminOnly, superAdminOnly } = require('../middleware/auth');
const { BUILT_IN, RESERVED, slugify, customCategories, saveCustomCategories, allCategories, isValidCategory, setCategoryEnabled } = require('../utils/categories');

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

// ── Product categories ─────────────────────────────────────────

// @GET /api/settings/categories — public (shop menus, filters and collection pages)
router.get('/categories', async (req, res) => {
  try {
    res.json({ success: true, categories: await allCategories() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/settings/categories { label, description? } — admin: add a custom category
router.post('/categories', protect, adminOnly, async (req, res) => {
  try {
    const label = String(req.body?.label || '').trim();
    const value = slugify(req.body?.value || label);
    if (!label || !value) return res.status(400).json({ success: false, message: 'Enter a category name.' });
    if (RESERVED.includes(value)) return res.status(400).json({ success: false, message: `"${value}" is already used by the shop — pick another name.` });
    const custom = await customCategories();
    if (BUILT_IN.some((c) => c.value === value) || custom.some((c) => c.value === value)) {
      return res.status(400).json({ success: false, message: 'That category already exists.' });
    }
    await saveCustomCategories([...custom, { value, label, description: String(req.body?.description || '').trim() }]);
    res.status(201).json({ success: true, categories: await allCategories() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PUT /api/settings/categories/:value { label?, description? } — admin: rename / describe.
// The slug (and so the page address) stays the same, so links and products keep working.
router.put('/categories/:value', protect, adminOnly, async (req, res) => {
  try {
    const custom = await customCategories();
    const i = custom.findIndex((c) => c.value === req.params.value);
    if (i < 0) return res.status(404).json({ success: false, message: 'Only categories you added can be edited.' });
    const label = req.body?.label != null ? String(req.body.label).trim() : custom[i].label;
    if (!label) return res.status(400).json({ success: false, message: 'Enter a category name.' });
    custom[i] = { ...custom[i], label, description: req.body?.description != null ? String(req.body.description).trim() : (custom[i].description || '') };
    await saveCustomCategories(custom);
    res.json({ success: true, categories: await allCategories() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PUT /api/settings/categories/:value/enabled { enabled } — admin: show or hide a
// category (built-in or custom) and its products in the shop.
router.put('/categories/:value/enabled', protect, adminOnly, async (req, res) => {
  try {
    if (!(await isValidCategory(req.params.value))) return res.status(404).json({ success: false, message: 'Category not found.' });
    await setCategoryEnabled(req.params.value, req.body?.enabled !== false);
    res.json({ success: true, categories: await allCategories() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @DELETE /api/settings/categories/:value — admin: remove a custom category no product uses
router.delete('/categories/:value', protect, adminOnly, async (req, res) => {
  try {
    const custom = await customCategories();
    if (!custom.some((c) => c.value === req.params.value)) {
      return res.status(404).json({ success: false, message: 'Only categories you added can be removed.' });
    }
    const inUse = await Product.count({ where: { category: req.params.value } });
    if (inUse) return res.status(400).json({ success: false, message: `${inUse} product(s) are in this category — move them to another category first.` });
    await saveCustomCategories(custom.filter((c) => c.value !== req.params.value));
    res.json({ success: true, categories: await allCategories() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
module.exports.getPaymentMethods = getPaymentMethods;
