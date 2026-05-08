const express = require('express');
const router = express.Router();
const { Op, fn, col } = require('sequelize');
const { Order, OrderItem, Product, User } = require('../models');
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

// @GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({
      where:      { role: 'customer' },
      attributes: { exclude: ['password'] },
      order:      [['createdAt', 'DESC']],
    });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
