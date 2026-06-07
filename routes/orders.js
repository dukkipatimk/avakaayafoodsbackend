const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { Order, OrderItem, OrderStatusHistory, Product, ProductVariant, User, LeadSession } = require('../models');
const { protect, adminOnly, staffOnly, optionalAuth } = require('../middleware/auth');
const { SHIPPING_ZONES } = require('./shipping');

// Recalculate shipping for an order after its items change.
// Mirrors POST /api/shipping/calculate — zone-based flat rates with India free-shipping.
function recalcShipping(zoneKey, method, subtotal, fallback) {
  const zone = SHIPPING_ZONES[zoneKey];
  if (!zone) return Number(fallback) || 0;            // unknown zone — keep existing cost
  const m = method === 'express' ? 'express' : 'standard';
  let cost = zone[m]?.rate ?? zone.standard.rate;
  if (zoneKey === 'india' && zone.freeAbove && subtotal >= zone.freeAbove) cost = 0;
  return cost;
}

// @POST /api/orders — requires login (no guest checkout)
router.post('/', protect, async (req, res) => {
  try {
    const {
      items, shippingAddress, billingAddress, shippingCost, shippingMethod,
      currency, paymentMethod, couponCode, discount, guestEmail, leadSessionId,
    } = req.body;

    // Billing is optional. Store it only when a distinct address with at least
    // a line1 was provided; null means "billing same as shipping".
    const normalizedBilling =
      billingAddress && String(billingAddress.line1 || '').trim()
        ? billingAddress
        : null;

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

      const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
      const isHamperItem = item.bundleType === 'hamper' && item.bundleId;
      orderItems.push({
        productId:     product.id,
        name:          product.name,
        image:         product.thumbnail,
        variantWeight: variant.weight,
        variantPrice:  variant.price,
        quantity,
        price:         Number(variant.price) * quantity,
        bundleId:      isHamperItem ? String(item.bundleId).slice(0, 120) : null,
        bundleType:    isHamperItem ? 'hamper' : null,
        bundleLabel:   isHamperItem ? 'Custom Gift Hamper' : null,
        customization: isHamperItem ? {
          personalMessage: String(item.customization?.personalMessage || '').trim().slice(0, 200),
          styleInstructions: String(item.customization?.styleInstructions || '').trim().slice(0, 300),
        } : null,
      });
    }

    if (orderItems.length === 0)
      return res.status(400).json({ success: false, message: 'No valid products found. Please refresh and try again.' });

    const ZONE_MAP = {
      'India': 'india', 'United States': 'usa', 'United Kingdom': 'uk',
      'Singapore': 'singapore', 'Australia': 'australia', 'Malaysia': 'malaysia',
    };
    const zone = ZONE_MAP[shippingAddress?.country] || 'other';
    const verifiedSubtotal = orderItems.reduce((sum, item) => sum + Number(item.price), 0);
    const verifiedDiscount = Math.max(0, Math.min(Number(discount) || 0, verifiedSubtotal));
    const verifiedShippingCost = Math.max(0, Number(shippingCost) || 0);
    const verifiedTotal = verifiedSubtotal - verifiedDiscount + verifiedShippingCost;

    const orderCount  = await Order.count();
    const orderNumber = `AKF${String(orderCount + 1001).padStart(5, '0')}`;

    // COD = "placed" immediately; online payment methods stay "awaiting_payment"
    // until Razorpay confirms via /verify or /callback. This prevents a stale
    // "placed" status sitting on orders that never completed payment.
    const isCod = paymentMethod === 'cod';
    const initialStatus = isCod ? 'placed' : 'awaiting_payment';

    const order = await Order.create({
      orderNumber,
      userId:         req.user?.id,
      guestEmail:     guestEmail || shippingAddress?.email,
      shippingAddress,
      billingAddress: normalizedBilling,
      shippingZone:   zone,
      shippingCost:   verifiedShippingCost,
      shippingMethod: shippingMethod || 'standard',
      subtotal:       verifiedSubtotal,
      discount:       verifiedDiscount,
      couponCode,
      total:          verifiedTotal,
      currency:       currency || 'INR',
      paymentMethod:  paymentMethod || 'razorpay',
      orderStatus:    initialStatus,
    });

    await OrderItem.bulkCreate(orderItems.map((i) => ({ ...i, orderId: order.id })));
    await OrderStatusHistory.create({
      orderId: order.id,
      status: initialStatus,
      note: isCod ? 'Order placed (Cash on Delivery)' : 'Order saved — awaiting payment',
    });

    if (leadSessionId) {
      await LeadSession.update({
        orderId: order.id,
        stage: 'order',
        status: isCod ? 'converted' : 'hot',
        name: shippingAddress?.fullName,
        email: guestEmail || shippingAddress?.email,
        phone: shippingAddress?.phone,
        country: shippingAddress?.country,
        region: shippingAddress?.state || shippingAddress?.country,
        city: shippingAddress?.city,
        cartValue: verifiedTotal,
        lastEventType: 'order_created',
        lastEventAt: new Date(),
      }, { where: { sessionId: leadSessionId } });
    }

    for (const item of orderItems) {
      await Product.increment('soldCount', { by: item.quantity, where: { id: item.productId } });
    }

    const fullOrder = await Order.findByPk(order.id, {
      include: [
        { model: OrderItem, as: 'items' },
        { model: OrderStatusHistory, as: 'statusHistory' },
      ],
    });

    // Notifications fire after payment success (see routes/payment.js → notifyOrderPaid),
    // not here, so customers don't get a "confirmed" email before paying.

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
      include: [
        {
          model: OrderItem, as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['name', 'images', 'slug'] }],
        },
        { model: OrderStatusHistory, as: 'statusHistory' },
      ],
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/orders — staff: all orders
router.get('/', protect, staffOnly, async (req, res) => {
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

// @PUT /api/orders/:id/status — staff (admin + store manager)
router.put('/:id/status', protect, staffOnly, async (req, res) => {
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
        const { sendEmail, orderShippedEmail }            = require('../utils/email');
        const { sendWhatsAppTemplate, orderShippedTemplate } = require('../utils/whatsapp');
        const addr    = order.shippingAddress;
        const emailTo = order.guestEmail || addr?.email;
        if (emailTo)
          sendEmail({ to: emailTo, subject: `Your Order #${order.orderNumber} Has Shipped`, html: orderShippedEmail(order) }).catch(() => {});
        if (addr?.phone) {
          sendWhatsAppTemplate({ phone: addr.phone, country: addr.country, ...orderShippedTemplate(order) })
            .catch((e) => console.error('WhatsApp (shipped) failed:', e.message));
        }
      } catch (e) {}
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PUT /api/orders/:id — staff: edit order line items (add / remove / change qty)
// Body: { items: [{ id?, productId, weight, quantity }] }
//   • items with `id`        → existing line items kept (original unit price preserved)
//   • items without `id`     → newly added line items (priced from the current variant)
//   • existing items omitted → removed from the order
// Subtotal, shipping and total are recalculated server-side; the response includes a
// `summary` with the before/after totals and the difference.
router.put('/:id', protect, staffOnly, async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [{ model: OrderItem, as: 'items' }],
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ success: false, message: 'An order must have at least one item' });

    const existingById = {};
    order.items.forEach((i) => { existingById[i.id] = i; });

    const finalItems = [];
    for (const it of items) {
      const qty = Math.max(1, parseInt(it.quantity) || 1);

      if (it.id && existingById[it.id]) {
        // Existing line item — preserve its original unit price.
        const ex = existingById[it.id];
        finalItems.push({
          id:            ex.id,
          productId:     ex.productId,
          name:          ex.name,
          image:         ex.image,
          variantWeight: ex.variantWeight,
          variantPrice:  ex.variantPrice,
          quantity:      qty,
          price:         Number(ex.variantPrice) * qty,
          bundleId:      ex.bundleId,
          bundleType:    ex.bundleType,
          bundleLabel:   ex.bundleLabel,
          customization: ex.customization,
        });
      } else {
        // Newly added line item — price from the current product variant.
        const product = await Product.findByPk(it.productId, {
          include: [{ model: ProductVariant, as: 'variants' }],
        });
        if (!product) continue;
        const variant = product.variants.find((v) => v.weight === it.weight);
        if (!variant) continue;
        finalItems.push({
          productId:     product.id,
          name:          product.name,
          image:         product.thumbnail,
          variantWeight: variant.weight,
          variantPrice:  variant.price,
          quantity:      qty,
          price:         Number(variant.price) * qty,
        });
      }
    }

    if (finalItems.length === 0)
      return res.status(400).json({ success: false, message: 'No valid products found for this order' });

    // Recalculate money — discount & tax are left untouched, shipping is re-derived.
    const previousTotal = Number(order.total);
    const subtotal      = finalItems.reduce((s, i) => s + Number(i.price), 0);
    const discount      = Number(order.discount) || 0;
    const tax           = Number(order.tax) || 0;
    const shippingCost  = recalcShipping(order.shippingZone, order.shippingMethod, subtotal, order.shippingCost);
    const total         = subtotal - discount + tax + shippingCost;
    const difference    = total - previousTotal;

    // Persist the new item set.
    const keptIds = finalItems.filter((i) => i.id).map((i) => i.id);
    await OrderItem.destroy({
      where: { orderId: order.id, id: { [Op.notIn]: keptIds.length ? keptIds : [0] } },
    });
    for (const i of finalItems) {
      if (i.id) {
        await OrderItem.update({ quantity: i.quantity, price: i.price }, { where: { id: i.id } });
      } else {
        await OrderItem.create({ ...i, orderId: order.id });
      }
    }

    await order.update({ subtotal, shippingCost, total });
    await OrderStatusHistory.create({
      orderId: order.id,
      status:  order.orderStatus,
      note:    `Items edited by ${req.user.name} — total ₹${previousTotal.toFixed(2)} → `
             + `₹${total.toFixed(2)} (${difference >= 0 ? '+' : '−'}₹${Math.abs(difference).toFixed(2)})`,
    });

    const fullOrder = await Order.findByPk(order.id, {
      include: [
        { model: OrderItem, as: 'items' },
        { model: OrderStatusHistory, as: 'statusHistory' },
      ],
    });

    res.json({
      success: true,
      order:   fullOrder,
      summary: { previousTotal, newTotal: total, difference, subtotal, shippingCost },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
