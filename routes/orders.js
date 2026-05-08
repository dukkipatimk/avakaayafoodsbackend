const express = require('express');
const router = express.Router();
const { Order, OrderItem, OrderStatusHistory, Product, ProductVariant, User } = require('../models');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');

// @POST /api/orders
router.post('/', optionalAuth, async (req, res) => {
  try {
    const {
      items, shippingAddress, shippingCost, shippingMethod,
      subtotal, total, currency, paymentMethod, couponCode, discount, guestEmail,
    } = req.body;

    if (!items || items.length === 0)
      return res.status(400).json({ success: false, message: 'No items in order' });

    const orderItems = [];
    for (const item of items) {
      const product = await Product.findByPk(item.productId, {
        include: [{ model: ProductVariant, as: 'variants' }],
      });
      if (!product) continue;
      const variant = product.variants.find((v) => v.weight === item.weight);
      if (!variant) continue;

      orderItems.push({
        productId:     product.id,
        name:          product.name,
        image:         product.thumbnail,
        variantWeight: variant.weight,
        variantPrice:  variant.price,
        quantity:      item.quantity,
        price:         variant.price * item.quantity,
      });
    }

    if (orderItems.length === 0)
      return res.status(400).json({ success: false, message: 'No valid products found. Please refresh and try again.' });

    const ZONE_MAP = {
      'India': 'india', 'United States': 'usa', 'United Kingdom': 'uk',
      'Singapore': 'singapore', 'Australia': 'australia', 'Malaysia': 'malaysia',
    };
    const zone = ZONE_MAP[shippingAddress?.country] || 'other';

    const orderCount  = await Order.count();
    const orderNumber = `AKF${String(orderCount + 1001).padStart(5, '0')}`;

    const order = await Order.create({
      orderNumber,
      userId:         req.user?.id,
      guestEmail:     guestEmail || shippingAddress?.email,
      shippingAddress,
      shippingZone:   zone,
      shippingCost:   shippingCost || 0,
      shippingMethod: shippingMethod || 'standard',
      subtotal,
      discount:       discount || 0,
      couponCode,
      total,
      currency:       currency || 'INR',
      paymentMethod:  paymentMethod || 'razorpay',
    });

    await OrderItem.bulkCreate(orderItems.map((i) => ({ ...i, orderId: order.id })));
    await OrderStatusHistory.create({ orderId: order.id, status: 'placed', note: 'Order placed successfully' });

    for (const item of orderItems) {
      await Product.increment('soldCount', { by: item.quantity, where: { id: item.productId } });
    }

    const fullOrder = await Order.findByPk(order.id, {
      include: [
        { model: OrderItem, as: 'items' },
        { model: OrderStatusHistory, as: 'statusHistory' },
      ],
    });

    const { sendEmail, orderConfirmationEmail } = require('../utils/email');
    const { sendWhatsApp, newOrderNotification }  = require('../utils/whatsapp');
    try {
      const emailTo = fullOrder.guestEmail || req.user?.email;
      if (emailTo)
        sendEmail({ to: emailTo, subject: `Order Confirmed #${fullOrder.orderNumber}`, html: orderConfirmationEmail(fullOrder) }).catch(() => {});
      if (process.env.ADMIN_PHONE)
        sendWhatsApp({ to: `whatsapp:+${process.env.ADMIN_PHONE}`, message: newOrderNotification(fullOrder) }).catch(() => {});
    } catch (e) {}

    res.status(201).json({ success: true, order: fullOrder });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/orders/my
router.get('/my', protect, async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      include: [{
        model: OrderItem, as: 'items',
        include: [{ model: Product, as: 'product', attributes: ['name', 'images'] }],
      }],
    });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/orders/:id
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [{
        model: OrderItem, as: 'items',
        include: [{ model: Product, as: 'product', attributes: ['name', 'images', 'slug'] }],
      }],
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/orders — admin: all orders
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const where = status ? { orderStatus: status } : {};
    const { count: total, rows: orders } = await Order.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit:  parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      include: [{ model: User, as: 'user', attributes: ['name', 'email'] }],
      distinct: true,
    });
    res.json({ success: true, orders, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PUT /api/orders/:id/status — admin
router.put('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status, trackingNumber, trackingUrl, note } = req.body;
    const updates = { orderStatus: status };
    if (trackingNumber) updates.trackingNumber = trackingNumber;
    if (trackingUrl)    updates.trackingUrl    = trackingUrl;

    await Order.update(updates, { where: { id: req.params.id } });
    await OrderStatusHistory.create({
      orderId: req.params.id,
      status,
      note: note || `Status updated to ${status}`,
    });

    const order = await Order.findByPk(req.params.id, {
      include: [{ model: OrderStatusHistory, as: 'statusHistory' }],
    });

    if (status === 'shipped') {
      try {
        const { sendEmail, orderShippedEmail }       = require('../utils/email');
        const { sendWhatsApp, orderShippedNotification } = require('../utils/whatsapp');
        const addr    = order.shippingAddress;
        const emailTo = order.guestEmail || addr?.email;
        if (emailTo)
          sendEmail({ to: emailTo, subject: `Your Order #${order.orderNumber} Has Shipped`, html: orderShippedEmail(order) }).catch(() => {});
        const customerPhone = addr?.phone;
        if (customerPhone) {
          const digits = customerPhone.replace(/\D/g, '');
          const to = digits.startsWith('91') ? `whatsapp:+${digits}` : `whatsapp:+91${digits}`;
          sendWhatsApp({ to, message: orderShippedNotification(order) }).catch(() => {});
        }
      } catch (e) {}
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
