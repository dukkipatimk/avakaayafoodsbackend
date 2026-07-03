const express = require('express');
const router = express.Router();
const { Op, fn, col, literal } = require('sequelize');
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
      // Exclude 'awaiting_payment' (abandoned checkouts) so "Total Orders" matches
      // the Orders list and the Users tab — those are leads, not real orders.
      Order.count({ where: { orderStatus: { [Op.ne]: 'awaiting_payment' } } }),
      Order.count({ where: { orderStatus: { [Op.ne]: 'awaiting_payment' }, createdAt: { [Op.gte]: startOfMonth } } }),
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

    // Revenue is financial data — only super admins may see it.
    const isSuper = req.user.role === 'super_admin';

    res.json({
      success: true,
      stats: {
        totalOrders,
        monthOrders,
        totalRevenue: isSuper ? (revenueRow?.dataValues?.total || 0) : undefined,
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

const ROLES = ['customer', 'admin', 'store_manager', 'super_admin'];

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
    const [users, allUsers, orders, leads, totalUsers] = await Promise.all([
      User.findAll({
        where,
        attributes: { exclude: ['password'] },
        order:      [['createdAt', 'DESC']],
      }),
      User.findAll({ attributes: ['id', 'email'], raw: true }),
      Order.findAll({ attributes: ['userId', 'guestEmail', 'total', 'paymentStatus', 'orderStatus'], raw: true }),
      // A "lead" only counts once the visitor reached checkout — browsing/cart-only
      // sessions are not leads. stage advances browsing → cart → checkout → order.
      // cartValue is the potential (abandoned) revenue for that lead. Exclude
      // 'converted' sessions: those became paid orders and are already counted
      // under Orders/Revenue, so counting them here too would double-count.
      LeadSession.findAll({
        attributes: ['userId', 'email', 'cartValue', 'stage'],
        // Reached checkout, not converted, AND has at least one product in the cart.
        where: {
          [Op.and]: [
            { stage: { [Op.in]: ['checkout', 'order'] }, status: { [Op.ne]: 'converted' } },
            literal('JSON_LENGTH(cartItems) > 0'),
          ],
        },
        raw: true,
      }),
      User.count(),
    ]);

    // email → userId, so guest orders / anonymous leads can be attributed to the
    // matching account.
    const emailToId = {};
    allUsers.forEach(u => { if (u.email) emailToId[String(u.email).toLowerCase()] = u.id; });

    const statsByUser = {};
    const bucket = (uid) =>
      statsByUser[uid] || (statsByUser[uid] = { orders: 0, revenue: 0, leads: 0, leadRevenue: 0 });

    // ORDERS + REVENUE. An 'awaiting_payment' order is an abandoned checkout
    // (payment never completed) — not a real order. Only placed/paid orders count.
    const isRealOrder = (o) => o.orderStatus !== 'awaiting_payment';
    let totalRevenue = 0;
    let totalOrders  = 0;
    for (const o of orders) {
      if (!isRealOrder(o)) continue;
      totalOrders += 1;
      if (o.paymentStatus === 'paid') totalRevenue += Number(o.total) || 0;
      let uid = o.userId;
      if (!uid && o.guestEmail) uid = emailToId[String(o.guestEmail).toLowerCase()];
      if (!uid) continue;
      const s = bucket(uid);
      s.orders += 1;
      if (o.paymentStatus === 'paid') s.revenue += Number(o.total) || 0;
    }

    // LEADS + LEAD REVENUE (potential value from checkout-stage sessions).
    let totalLeads       = 0;
    let totalLeadRevenue = 0;
    for (const l of leads) {
      totalLeads += 1;
      totalLeadRevenue += Number(l.cartValue) || 0;
      let uid = l.userId;
      if (!uid && l.email) uid = emailToId[String(l.email).toLowerCase()];
      if (!uid) continue;
      const s = bucket(uid);
      s.leads += 1;
      s.leadRevenue += Number(l.cartValue) || 0;
    }

    // Revenue is financial data — only super admins may see it. Counts (orders,
    // leads) stay visible to all admins.
    const isSuper = req.user.role === 'super_admin';

    const withStats = users.map(u => {
      const plain = u.toJSON();
      const s = statsByUser[u.id] || { orders: 0, revenue: 0, leads: 0, leadRevenue: 0 };
      plain.orderCount  = s.orders;
      plain.leadCount   = s.leads;
      plain.revenue     = isSuper ? s.revenue : undefined;
      plain.leadRevenue = isSuper ? s.leadRevenue : undefined;
      return plain;
    });

    res.json({
      success: true,
      users:  withStats,
      counts: {
        users:       totalUsers,
        orders:      totalOrders,
        leads:       totalLeads,
        revenue:     isSuper ? totalRevenue : undefined,
        leadRevenue: isSuper ? totalLeadRevenue : undefined,
      },
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

    // Only real orders — exclude 'awaiting_payment' (abandoned checkouts) so this
    // list matches the order count shown on the Users tab.
    const orders = await Order.findAll({
      where:   { orderStatus: { [Op.ne]: 'awaiting_payment' }, [Op.or]: clauses },
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
    // Creating a staff account assigns a role — restricted to super admins.
    if (req.user.role !== 'super_admin')
      return res.status(403).json({ success: false, message: 'Only a super admin can create staff accounts' });
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
      // Role management is restricted to super admins — a normal admin cannot
      // change any user's role.
      if (req.user.role !== 'super_admin')
        return res.status(403).json({ success: false, message: 'Only a super admin can change user roles' });
      if (!ROLES.includes(role))
        return res.status(400).json({ success: false, message: 'Invalid role' });
      if (isSelf && role !== user.role)
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
