const express = require('express');
const router = express.Router();
const { Store } = require('../models');
const { protect, adminOnly } = require('../middleware/auth');

const ORDER = [['sortOrder', 'ASC'], ['createdAt', 'ASC']];
const EDITABLE = ['name', 'area', 'address', 'city', 'state', 'phone', 'hours', 'statusOverride', 'mapUrl', 'sortOrder', 'isActive'];
const STATUS_OVERRIDES = new Set(['auto', 'open', 'closed', 'coming_soon']);

const parseTime = (value, fallbackMinutes) => {
  const match = String(value || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return fallbackMinutes;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridian = match[3]?.toLowerCase();
  if (meridian === 'pm' && hour < 12) hour += 12;
  if (meridian === 'am' && hour === 12) hour = 0;
  return (hour * 60) + minute;
};

const parseHoursRange = (hours) => {
  const normalized = String(hours || '').replace(/[–—-]/g, '-');
  const [openText, closeText] = normalized.split('-').map(part => part?.trim());
  if (!openText || !closeText) return null;
  const openMinutes = parseTime(openText, null);
  const closeMinutes = parseTime(closeText, null);
  if (openMinutes === null || closeMinutes === null) return null;
  return { openMinutes, closeMinutes };
};

const branchStatus = (store) => {
  const override = store.statusOverride || 'auto';
  if (override === 'open') return { status: 'open', statusLabel: 'Open', statusNote: 'Manually marked open' };
  if (override === 'closed') return { status: 'closed', statusLabel: 'Closed', statusNote: 'Manually marked closed' };
  if (override === 'coming_soon') return { status: 'coming_soon', statusLabel: 'Coming Soon', statusNote: 'Branch is not open yet' };

  const range = parseHoursRange(store.hours);
  if (!range) return { status: 'open', statusLabel: 'Open', statusNote: store.hours || 'Hours not configured' };

  const now = new Date();
  const hyderabadNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const currentMinutes = (hyderabadNow.getHours() * 60) + hyderabadNow.getMinutes();
  const { openMinutes, closeMinutes } = range;
  const open = closeMinutes > openMinutes
    ? currentMinutes >= openMinutes && currentMinutes < closeMinutes
    : currentMinutes >= openMinutes || currentMinutes < closeMinutes;

  return {
    status: open ? 'open' : 'closed',
    statusLabel: open ? 'Open Now' : 'Closed Now',
    statusNote: store.hours || 'Hours not configured',
  };
};

const serializeStore = (store) => {
  const plain = store.get ? store.get({ plain: true }) : store;
  return { ...plain, ...branchStatus(plain) };
};

// @GET /api/stores — public: active stores. ?all=1 → include inactive (admin).
router.get('/', async (req, res) => {
  try {
    const where = req.query.all ? {} : { isActive: true };
    const stores = await Store.findAll({ where, order: ORDER });
    res.json({ success: true, stores: stores.map(serializeStore) });
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
    if (data.statusOverride && !STATUS_OVERRIDES.has(data.statusOverride)) {
      return res.status(400).json({ success: false, message: 'Invalid store status override' });
    }
    const store = await Store.create(data);
    res.status(201).json({ success: true, store: serializeStore(store) });
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
    if (updates.statusOverride && !STATUS_OVERRIDES.has(updates.statusOverride)) {
      return res.status(400).json({ success: false, message: 'Invalid store status override' });
    }
    await store.update(updates);
    res.json({ success: true, store: serializeStore(store) });
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
