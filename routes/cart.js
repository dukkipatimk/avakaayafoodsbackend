const express = require('express');
const router = express.Router();
// Cart is primarily managed client-side in localStorage for guests
// This provides server-side persistence for logged-in users

const Cart = require('../models/Cart');
const { protect } = require('../middleware/auth');

router.get('/', protect, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate('items.product', 'name thumbnail variants isActive');
    if (!cart) cart = { items: [] };
    res.json({ success: true, cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/sync', protect, async (req, res) => {
  try {
    const { items } = req.body;
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = new Cart({ user: req.user._id, items: [] });
    cart.items = items;
    await cart.save();
    res.json({ success: true, cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
