const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');

// @POST /api/orders - place order
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { items, shippingAddress, shippingCost, shippingMethod, subtotal, total, currency, paymentMethod, couponCode, discount, guestEmail } = req.body;

    if (!items || items.length === 0) return res.status(400).json({ success: false, message: 'No items in order' });

    // Validate and fetch products
    const orderItems = [];
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) continue;
      const variant = product.variants.find(v => v.weight === item.weight);
      if (!variant) continue;

      orderItems.push({
        product: product._id,
        name: product.name,
        image: product.thumbnail,
        variant: { weight: variant.weight, price: variant.price },
        quantity: item.quantity,
        price: variant.price * item.quantity
      });
    }

    if (orderItems.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid products found. Please refresh and try again.' });
    }

    const ZONE_MAP = {
      'India': 'india', 'United States': 'usa', 'United Kingdom': 'uk',
      'Singapore': 'singapore', 'Australia': 'australia', 'Malaysia': 'malaysia',
    };
    const zone = ZONE_MAP[shippingAddress?.country] || 'other';

    const order = await Order.create({
      user: req.user?._id,
      guestEmail: guestEmail || shippingAddress?.email,
      items: orderItems,
      shippingAddress,
      shippingZone: zone,
      shippingCost: shippingCost || 0,
      shippingMethod: shippingMethod || 'standard',
      subtotal,
      discount: discount || 0,
      couponCode,
      total,
      currency: currency || 'INR',
      paymentMethod: paymentMethod || 'razorpay',
      statusHistory: [{ status: 'placed', note: 'Order placed successfully' }]
    });

    // Update sold counts
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.product, { $inc: { soldCount: item.quantity } });
    }

    // Send notifications (non-blocking)
    const { sendEmail, orderConfirmationEmail } = require('../utils/email');
    const { sendWhatsApp, newOrderNotification } = require('../utils/whatsapp');
    try {
      const emailTo = order.guestEmail || (req.user?.email);
      if (emailTo) sendEmail({ to: emailTo, subject: `Order Confirmed #${order.orderNumber}`, html: orderConfirmationEmail(order) }).catch(() => {});
      // Admin WhatsApp notification
      if (process.env.ADMIN_PHONE) sendWhatsApp({ to: `whatsapp:+${process.env.ADMIN_PHONE}`, message: newOrderNotification(order) }).catch(() => {});
    } catch(e) {}

    res.status(201).json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/orders/my - user's orders
router.get('/my', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).populate('items.product', 'name images');
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/orders/:id - single order
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product', 'name images slug');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/orders - admin: all orders
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query = status ? { orderStatus: status } : {};
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('user', 'name email');
    const total = await Order.countDocuments(query);
    res.json({ success: true, orders, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PUT /api/orders/:id/status - admin update order status
router.put('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status, trackingNumber, trackingUrl, note } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id, {
      orderStatus: status,
      ...(trackingNumber && { trackingNumber }),
      ...(trackingUrl && { trackingUrl }),
      $push: { statusHistory: { status, note: note || `Status updated to ${status}` } }
    }, { new: true });

    // Send shipping notifications (non-blocking)
    if (status === 'shipped') {
      try {
        const { sendEmail, orderShippedEmail } = require('../utils/email');
        const { sendWhatsApp, orderShippedNotification } = require('../utils/whatsapp');

        const emailTo = order.guestEmail || order.shippingAddress?.email;
        if (emailTo) {
          sendEmail({ to: emailTo, subject: `Your Order #${order.orderNumber} Has Shipped`, html: orderShippedEmail(order) }).catch(() => {});
        }

        const customerPhone = order.shippingAddress?.phone;
        if (customerPhone) {
          const digits = customerPhone.replace(/\D/g, '');
          const to = digits.startsWith('91') ? `whatsapp:+${digits}` : `whatsapp:+91${digits}`;
          sendWhatsApp({ to, message: orderShippedNotification(order) }).catch(() => {});
        }
      } catch(e) {}
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
