const express = require('express');
const router = express.Router();
const { Cart, CartItem, Product, ProductVariant } = require('../models');
const { protect } = require('../middleware/auth');

// @GET /api/cart
router.get('/', protect, async (req, res) => {
  try {
    let cart = await Cart.findOne({
      where: { userId: req.user.id },
      include: [{
        model: CartItem, as: 'items',
        include: [{
          model: Product, as: 'product',
          attributes: ['id', 'name', 'thumbnail', 'isActive'],
          include: [{ model: ProductVariant, as: 'variants' }],
        }],
      }],
    });
    if (!cart) cart = { items: [] };
    res.json({ success: true, cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/cart/sync
router.post('/sync', protect, async (req, res) => {
  try {
    const { items } = req.body;
    let cart = await Cart.findOne({ where: { userId: req.user.id } });
    if (!cart) cart = await Cart.create({ userId: req.user.id });

    await CartItem.destroy({ where: { cartId: cart.id } });
    if (items?.length) {
      await CartItem.bulkCreate(
        items.map((i) => ({
          cartId:    cart.id,
          productId: i.product || i.productId,
          weight:    i.weight,
          quantity:  i.quantity,
          price:     i.price,
        }))
      );
    }

    const updated = await Cart.findByPk(cart.id, {
      include: [{ model: CartItem, as: 'items' }],
    });
    res.json({ success: true, cart: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
