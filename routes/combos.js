const express = require('express');
const router = express.Router();
const { Combo, ComboItem, Product, ProductVariant } = require('../models');
const { protect, adminOnly } = require('../middleware/auth');

const COMBO_INCLUDE = [{
  model: ComboItem,
  as: 'items',
  include: [{
    model: Product,
    as: 'product',
    attributes: ['id', 'name', 'slug', 'thumbnail', 'images', 'isVeg'],
    include: [{ model: ProductVariant, as: 'variants', attributes: ['weight', 'price', 'mrp', 'stock'] }],
  }],
}];

// What the bundle would cost if bought as loose items — the strikethrough price.
// Derived from live variant prices rather than stored, so it can never drift
// out of date against the catalogue.
function decorate(combo) {
  const json = combo.toJSON ? combo.toJSON() : combo;
  const members = json.items || [];
  const unitPrice = (member) => {
    const variant = (member.product?.variants || []).find((v) => v.weight === member.weight);
    return Number(variant?.price) || 0;
  };

  // For a "pick any N" combo the comparison is the N most expensive choices,
  // so the advertised saving is one the customer can actually realise.
  let compareAt;
  if (json.type === 'pick') {
    const n = Math.max(1, Number(json.pickCount) || 1);
    compareAt = members.map(unitPrice).sort((a, b) => b - a).slice(0, n)
      .reduce((sum, p) => sum + p, 0);
  } else {
    compareAt = members.reduce((sum, m) => sum + unitPrice(m) * Math.max(1, Number(m.quantity) || 1), 0);
  }

  const price = Number(json.price) || 0;
  return { ...json, compareAtPrice: compareAt, savings: Math.max(0, Math.round(compareAt - price)) };
}

// @GET /api/combos — public: live combos for the storefront.
router.get('/', async (req, res) => {
  try {
    const combos = await Combo.findAll({
      where: { isActive: true },
      include: COMBO_INCLUDE,
      order: [['sortOrder', 'ASC'], ['createdAt', 'DESC']],
    });
    // A combo whose products were all deleted would render as an empty card.
    res.json({ success: true, combos: combos.filter((c) => (c.items || []).length).map(decorate) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/combos/:id — public: one combo (used by the builder sheet).
router.get('/:id', async (req, res) => {
  try {
    const combo = await Combo.findByPk(req.params.id, { include: COMBO_INCLUDE });
    if (!combo || !combo.isActive) return res.status(404).json({ success: false, message: 'Combo not found' });
    res.json({ success: true, combo: decorate(combo) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Admin ───────────────────────────────────────────────────────────────────
router.use(protect, adminOnly);

// @GET /api/combos/admin/all — every combo, including inactive ones.
router.get('/admin/all', async (req, res) => {
  try {
    const combos = await Combo.findAll({
      include: COMBO_INCLUDE,
      order: [['sortOrder', 'ASC'], ['createdAt', 'DESC']],
    });
    res.json({ success: true, combos: combos.map(decorate) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Replaces a combo's member list. Members are validated against real product
// variants so a combo can never reference a weight that isn't sold.
async function replaceItems(comboId, items) {
  await ComboItem.destroy({ where: { comboId } });
  const rows = [];
  for (const item of Array.isArray(items) ? items : []) {
    const product = await Product.findByPk(item.productId, {
      include: [{ model: ProductVariant, as: 'variants', attributes: ['weight'] }],
    });
    if (!product) continue;
    const variant = (product.variants || []).find((v) => v.weight === item.weight);
    if (!variant) continue;
    rows.push({
      comboId,
      productId: product.id,
      weight: variant.weight,
      quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
    });
  }
  if (rows.length) await ComboItem.bulkCreate(rows);
  return rows.length;
}

const comboFields = (body) => ({
  name:        String(body.name || '').trim().slice(0, 200),
  subtitle:    body.subtitle ? String(body.subtitle).trim().slice(0, 255) : null,
  description: body.description ? String(body.description).trim() : null,
  image:       body.image ? String(body.image).trim().slice(0, 500) : null,
  type:        body.type === 'pick' ? 'pick' : 'fixed',
  pickCount:   Math.max(1, parseInt(body.pickCount, 10) || 3),
  price:       Math.max(0, Number(body.price) || 0),
  isActive:    body.isActive !== false,
  sortOrder:   parseInt(body.sortOrder, 10) || 0,
});

// @POST /api/combos
router.post('/', async (req, res) => {
  try {
    const fields = comboFields(req.body);
    if (!fields.name) return res.status(400).json({ success: false, message: 'Combo name is required' });
    if (!fields.price) return res.status(400).json({ success: false, message: 'Combo price is required' });

    const combo = await Combo.create(fields);
    const count = await replaceItems(combo.id, req.body.items);
    if (!count) {
      await combo.destroy();
      return res.status(400).json({ success: false, message: 'Add at least one valid product to the combo' });
    }
    if (fields.type === 'pick' && count < fields.pickCount) {
      await combo.destroy();
      return res.status(400).json({
        success: false,
        message: `A "pick any ${fields.pickCount}" combo needs at least ${fields.pickCount} products to choose from`,
      });
    }
    const saved = await Combo.findByPk(combo.id, { include: COMBO_INCLUDE });
    res.status(201).json({ success: true, combo: decorate(saved) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PUT /api/combos/:id
router.put('/:id', async (req, res) => {
  try {
    const combo = await Combo.findByPk(req.params.id);
    if (!combo) return res.status(404).json({ success: false, message: 'Combo not found' });

    const fields = comboFields(req.body);
    if (!fields.name) return res.status(400).json({ success: false, message: 'Combo name is required' });
    await combo.update(fields);

    if (req.body.items !== undefined) {
      const count = await replaceItems(combo.id, req.body.items);
      if (!count) return res.status(400).json({ success: false, message: 'A combo needs at least one valid product' });
      if (fields.type === 'pick' && count < fields.pickCount) {
        return res.status(400).json({
          success: false,
          message: `A "pick any ${fields.pickCount}" combo needs at least ${fields.pickCount} products to choose from`,
        });
      }
    }
    const saved = await Combo.findByPk(combo.id, { include: COMBO_INCLUDE });
    res.json({ success: true, combo: decorate(saved) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @DELETE /api/combos/:id
router.delete('/:id', async (req, res) => {
  try {
    const combo = await Combo.findByPk(req.params.id);
    if (!combo) return res.status(404).json({ success: false, message: 'Combo not found' });
    await combo.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
