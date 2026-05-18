const express = require('express');
const router = express.Router();
const { Store } = require('../models');
const { protect, adminOnly } = require('../middleware/auth');

const ORDER = [['sortOrder', 'ASC'], ['createdAt', 'ASC']];
const EDITABLE = ['name', 'area', 'address', 'city', 'state', 'phone', 'hours', 'mapUrl', 'sortOrder', 'isActive'];

// @GET /api/stores — public: active stores. ?all=1 → include inactive (admin).
router.get('/', async (req, res) => {
  try {
    const where = req.query.all ? {} : { isActive: true };
    const stores = await Store.findAll({ where, order: ORDER });
    res.json({ success: true, stores });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/stores — admin: create a store
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    if (!req.body.name || !req.body.name.trim())
      return res.status(400).json({ success: false, message: 'Store name is required' });
    const data = {};
    for (const k of EDITABLE) if (req.body[k] !== undefined) data[k] = req.body[k];
    const store = await Store.create(data);
    res.status(201).json({ success: true, store });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// @PUT /api/stores/:id — admin: update a store
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const store = await Store.findByPk(req.params.id);
    if (!store) return res.status(404).json({ success: false, message: 'Store not found' });
    const updates = {};
    for (const k of EDITABLE) if (req.body[k] !== undefined) updates[k] = req.body[k];
    await store.update(updates);
    res.json({ success: true, store });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// @DELETE /api/stores/:id — admin: remove a store
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const removed = await Store.destroy({ where: { id: req.params.id } });
    if (!removed) return res.status(404).json({ success: false, message: 'Store not found' });
    res.json({ success: true, message: 'Store deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
