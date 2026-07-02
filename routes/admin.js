const express = require('express');
const router = express.Router();
const { Op, fn, col } = require('sequelize');
const { Order, OrderItem, OrderStatusHistory, Product, User, LeadSession } = require('../models');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);

// @GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const today        = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalOrders,
      monthOrders,
      revenueRow,
      totalProducts,
      totalUsers,
      recentOrders,
      pendingOrders,
    ] = await Promise.all([
      Order.count(),
      Order.count({ where: { createdAt: { [Op.gte]: startOfMonth } } }),
      Order.findOne({
        where:      { paymentStatus: 'paid' },
        attributes: [[fn('SUM', col('total')), 'total']],
      }),
      Product.count({ where: { isActive: true } }),
      User.count({ where: { role: 'customer' } }),
      Order.findAll({
        order:   [['createdAt', 'DESC']],
        limit:   5,
        include: [{ model: User, as: 'user', attributes: ['name', 'email'] }],
      }),
      Order.count({ where: { orderStatus: 'placed' } }),
    ]);

    res.json({
      success: true,
      stats: {
        totalOrders,
        monthOrders,
        totalRevenue: revenueRow?.dataValues?.total || 0,
        totalProducts,
        totalUsers,
        pendingOrders,
      },
      recentOrders,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const ROLES = ['customer', 'admin', 'store_manager'];

// @GET /api/admin/users  — optional ?role=customer|admin|store_manager (omit for all)
// Also returns each user's order count + revenue, and the global totals
// (users / orders / leads) so the Users tab can show summary chips.
//
// Orders are matched to a customer by userId OR by guestEmail — the storefront
// lets logged-in customers check out without their order being tied to a userId
// (guest orders carry only the email), so a userId-only join shows 0 for
// everyone. We aggregate in JS off a lightweight order projection instead.
router.get('/users', async (req, res) => {
  try {
    const { role } = req.query;
    const where = role && ROLES.includes(role) ? { role } : {};
    const [users, allUsers, orders, totalUsers, totalLeads] = await Promise.all([
      User.findAll({
        where,
        attributes: { exclude: ['password'] },
        order:      [['createdAt', 'DESC']],
      }),
      User.findAll({ attributes: ['id', 'email'], raw: true }),
      Order.findAll({ attributes: ['userId', 'guestEmail', 'total', 'paymentStatus', 'orderStatus'], raw: true }),
      User.count(),
      LeadSession.count(),
    ]);

    // email → userId, so guest orders can be attributed to the matching account.
    const emailToId = {};
    allUsers.forEach(u => { if (u.email) emailToId[String(u.email).toLowerCase()] = u.id; });

    // Differentiate real ORDERS from LEADS: an 'awaiting_payment' order is an
    // abandoned checkout (payment never completed) — it's a lead, not an order.
    // Only placed/paid orders count toward order stats and revenue.
    const isRealOrder = (o) => o.orderStatus !== 'awaiting_payment';

    const statsByUser = {};
    let totalRevenue = 0;
    let totalOrders  = 0;
    for (const o of orders) {
      if (!isRealOrder(o)) continue;               // abandoned checkout → counted as a lead, not an order
      totalOrders += 1;
      if (o.paymentStatus === 'paid') totalRevenue += Number(o.total) || 0;
      let uid = o.userId;
      if (!uid && o.guestEmail) uid = emailToId[String(o.guestEmail).toLowerCase()];
      if (!uid) continue;
      const s = statsByUser[uid] || (statsByUser[uid] = { orders: 0, revenue: 0 });
      s.orders += 1;
      if (o.paymentStatus === 'paid') s.revenue += Number(o.total) || 0;
    }

    const withStats = users.map(u => {
      const plain = u.toJSON();
      const s = statsByUser[u.id] || { orders: 0, revenue: 0 };
      plain.orderCount = s.orders;
      plain.revenue    = s.revenue;
      return plain;
    });

    res.json({
      success: true,
      users:  withStats,
      counts: { users: totalUsers, orders: totalOrders, revenue: totalRevenue, leads: totalLeads },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/admin/users/:id/orders — every order placed by this customer,
// matched by account id OR by the email on guest orders they placed.
router.get('/users/:id/orders', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, { attributes: ['id', 'email'] });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const clauses = [{ userId: user.id }];
    if (user.email) clauses.push({ guestEmail: user.email });

    const orders = await Order.findAll({
      where:   { [Op.or]: clauses },
      order:   [['createdAt', 'DESC']],
      include: [{ model: OrderItem, as: 'items', attributes: ['name', 'variantWeight', 'quantity', 'price'] }],
    });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/admin/users  — create a staff (or customer) account
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    if (role && !ROLES.includes(role))
      return res.status(400).json({ success: false, message: 'Invalid role' });

    const existing = await User.findOne({ where: { email: email.trim().toLowerCase() } });
    if (existing)
      return res.status(409).json({ success: false, message: 'A user with this email already exists' });

    const user = await User.create({
      name:            name.trim(),
      email:           email.trim().toLowerCase(),
      password,                       // hashed by the beforeCreate hook
      phone:           phone || null,
      role:            role || 'store_manager',
      isEmailVerified: true,          // staff accounts created by an admin are pre-verified
    });

    const plain = user.toJSON();
    delete plain.password;
    res.status(201).json({ success: true, user: plain });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PATCH /api/admin/users/:id  — change a user's role and/or active status
router.patch('/users/:id', async (req, res) => {
  try {
    const { role, isActive } = req.body;
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isSelf = String(user.id) === String(req.user.id);
    const updates = {};

    if (role !== undefined) {
      if (!ROLES.includes(role))
        return res.status(400).json({ success: false, message: 'Invalid role' });
      if (isSelf && role !== 'admin')
        return res.status(400).json({ success: false, message: 'You cannot change your own role' });
      updates.role = role;
    }

    if (isActive !== undefined) {
      if (isSelf && !isActive)
        return res.status(400).json({ success: false, message: 'You cannot deactivate your own account' });
      updates.isActive = !!isActive;
    }

    await user.update(updates);
    const plain = user.toJSON();
    delete plain.password;
    res.json({ success: true, user: plain });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PATCH /api/admin/users/:id/password — set a new temporary password for a user
router.patch('/users/:id/password', async (req, res) => {
  try {
    const password = String(req.body.password || '');
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.password = password;
    await user.save();
    res.json({ success: true, message: `Password updated for ${user.email}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/admin/orders/:id/verify-upi — admin confirms direct-UPI receipt
router.post('/orders/:id/verify-upi', async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.paymentMethod !== 'upi') {
      return res.status(400).json({ success: false, message: 'Order is not a UPI payment' });
    }

    await order.update({ paymentStatus: 'paid', orderStatus: 'confirmed' });
    await OrderStatusHistory.create({
      orderId: order.id,
      status: 'confirmed',
      note: `UPI payment verified by admin (txn: ${order.paymentId || 'n/a'})`,
    });
    await LeadSession.update({ status: 'converted' }, { where: { orderId: order.id } });

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
