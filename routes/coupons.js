const express = require('express');
const router = express.Router();
const { Coupon, CouponUsedBy } = require('../models');
const { protect, adminOnly } = require('../middleware/auth');

// @POST /api/coupons/validate
router.post('/validate', async (req, res) => {
  try {
    const { code, subtotal, userId } = req.body;
    if (!code || subtotal === undefined)
      return res.status(400).json({ success: false, message: 'code and subtotal are required' });

    const coupon = await Coupon.findOne({
      where: { code: code.toUpperCase().trim() },
      include: [{ model: CouponUsedBy, as: 'usedBy' }],
    });

    if (!coupon)              return res.status(404).json({ success: false, message: 'Invalid coupon code' });
    if (!coupon.isActive)    return res.status(400).json({ success: false, message: 'Coupon is no longer active' });
    if (coupon.expiresAt && new Date() > coupon.expiresAt)
                              return res.status(400).json({ success: false, message: 'Coupon has expired' });
    if (subtotal < coupon.minOrder)
                              return res.status(400).json({ success: false, message: `Minimum order amount of ₹${coupon.minOrder} required to use this coupon` });
    if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit)
                              return res.status(400).json({ success: false, message: 'Coupon usage limit has been reached' });

    if (userId && coupon.perUserLimit > 0) {
      const userUses = coupon.usedBy.filter((e) => e.userId && e.userId.toString() === userId.toString()).length;
      if (userUses >= coupon.perUserLimit)
        return res.status(400).json({ success: false, message: 'You have already used this coupon the maximum number of times' });
    }

    let discount = 0;
    if (coupon.type === 'percent') {
      const raw = (coupon.value / 100) * subtotal;
      discount = coupon.maxDiscount > 0 ? Math.min(raw, coupon.maxDiscount) : raw;
    } else {
      discount = Math.min(coupon.value, subtotal);
    }
    discount = Math.round(discount * 100) / 100;

    res.json({
      success: true,
      discount,
      message: `Coupon applied! You save ₹${discount}`,
      coupon: { id: coupon.id, code: coupon.code, type: coupon.type, value: coupon.value, maxDiscount: coupon.maxDiscount },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/coupons — admin only
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const coupon = await Coupon.create(req.body);
    res.status(201).json({ success: true, coupon });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// @GET /api/coupons — admin only
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const coupons = await Coupon.findAll({ order: [['createdAt', 'DESC']] });
    res.json({ success: true, coupons });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @DELETE /api/coupons/:id — admin only (deactivate)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const [updated] = await Coupon.update({ isActive: false }, { where: { id: req.params.id } });
    if (!updated) return res.status(404).json({ success: false, message: 'Coupon not found' });
    const coupon = await Coupon.findByPk(req.params.id);
    res.json({ success: true, message: 'Coupon deactivated', coupon });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
