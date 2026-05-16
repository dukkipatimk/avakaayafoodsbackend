const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { User, UserAddress, UserWishlist, Product, ProductVariant } = require('../models');
const { protect } = require('../middleware/auth');
const { sendEmail, passwordResetEmail } = require('../utils/email');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });

// @POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email and password' });
    }
    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }
    if (!address || !address.line1 || !address.city || !address.pincode) {
      return res.status(400).json({ success: false, message: 'Delivery address (line 1, city, pincode) is required' });
    }

    const exists = await User.findOne({ where: { email } });
    if (exists) return res.status(400).json({ success: false, message: 'Email already registered' });

    const user = await User.create({ name, email, password, phone });

    // If the registration form included an address, save it as the user's default
    if (address && (address.line1 || address.city || address.pincode)) {
      await UserAddress.create({
        userId:    user.id,
        label:     address.label || 'Home',
        fullName:  address.fullName || name,
        phone:     address.phone || phone,
        line1:     address.line1 || '',
        line2:     address.line2 || '',
        city:      address.city || '',
        state:     address.state || '',
        pincode:   address.pincode || '',
        country:   address.country || 'India',
        isDefault: true,
      });
    }

    res.status(201).json({
      success: true,
      token: generateToken(user.id),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid email or password' });

    res.json({
      success: true,
      token: generateToken(user.id),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ where: { email } });
    if (user) {
      // Token secret is scoped to the current password hash, so the link
      // becomes invalid the moment the password changes (single use).
      const secret = (process.env.JWT_SECRET || 'fallback_secret') + user.password;
      const token = jwt.sign({ id: user.id }, secret, { expiresIn: '1h' });
      const base = (process.env.FRONTEND_URL || 'https://avakaayafoods.com').replace(/\/$/, '');
      const link = `${base}/reset-password?id=${user.id}&token=${token}`;
      try {
        await sendEmail({
          to: user.email,
          subject: 'Reset your Avakaaya Foods password',
          html: passwordResetEmail(user.name, link),
        });
      } catch (e) {
        console.error('[forgot-password] email send failed:', e.message);
      }
    }

    // Always respond identically — never reveal whether an account exists
    res.json({ success: true, message: 'If an account exists for that email, a reset link has been sent.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { id, token, password } = req.body;
    if (!id || !token || !password) {
      return res.status(400).json({ success: false, message: 'Invalid reset request' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const user = await User.findByPk(id);
    if (!user) return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired' });

    const secret = (process.env.JWT_SECRET || 'fallback_secret') + user.password;
    try {
      jwt.verify(token, secret);
    } catch (e) {
      return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired' });
    }

    user.password = password; // beforeUpdate hook hashes it
    await user.save();
    res.json({ success: true, message: 'Password updated. You can now sign in.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: UserAddress, as: 'addresses' }],
    });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PUT /api/auth/profile
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, phone } = req.body;
    await User.update({ name, phone }, { where: { id: req.user.id } });
    const user = await User.findByPk(req.user.id, { attributes: { exclude: ['password'] } });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/auth/address
router.post('/address', protect, async (req, res) => {
  try {
    if (req.body.isDefault) {
      await UserAddress.update({ isDefault: false }, { where: { userId: req.user.id } });
    }
    await UserAddress.create({ ...req.body, userId: req.user.id });
    const addresses = await UserAddress.findAll({ where: { userId: req.user.id } });
    res.json({ success: true, addresses });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @DELETE /api/auth/address/:index
router.delete('/address/:index', protect, async (req, res) => {
  try {
    const index = parseInt(req.params.index);
    const addresses = await UserAddress.findAll({ where: { userId: req.user.id } });
    if (isNaN(index) || index < 0 || index >= addresses.length)
      return res.status(400).json({ success: false, message: 'Invalid address index' });

    await addresses[index].destroy();
    const updated = await UserAddress.findAll({ where: { userId: req.user.id } });
    res.json({ success: true, addresses: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/auth/wishlist/:productId — toggle
router.post('/wishlist/:productId', protect, async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const existing = await UserWishlist.findOne({ where: { userId: req.user.id, productId } });
    if (existing) {
      await existing.destroy();
    } else {
      await UserWishlist.create({ userId: req.user.id, productId });
    }
    const rows = await UserWishlist.findAll({ where: { userId: req.user.id } });
    res.json({ success: true, wishlist: rows.map((r) => r.productId) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/auth/wishlist
router.get('/wishlist', protect, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{
        model: Product,
        as: 'wishlist',
        attributes: ['id', 'name', 'slug', 'thumbnail', 'rating'],
        include: [{ model: ProductVariant, as: 'variants' }],
      }],
    });
    res.json({ success: true, wishlist: user.wishlist });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
