const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Product, ProductVariant, ProductReview } = require('../models');
const { protect, adminOnly } = require('../middleware/auth');

// @GET /api/products
router.get('/', async (req, res) => {
  try {
    const { category, search, sort, featured, page = 1, limit = 12, minPrice, maxPrice } = req.query;
    const where = { isActive: true };

    if (category) where.category = category;
    if (featured)  where.isFeatured = true;
    if (search) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { name:             { [Op.like]: term } },
        { shortDescription: { [Op.like]: term } },
        { description:      { [Op.like]: term } },
        { category:         { [Op.like]: term } },
      ];
    }

    const variantInclude = { model: ProductVariant, as: 'variants', required: false };

    if (minPrice !== undefined || maxPrice !== undefined) {
      const priceWhere = {};
      if (minPrice !== undefined) priceWhere.price = { [Op.gte]: parseFloat(minPrice) };
      if (maxPrice !== undefined) priceWhere.price = { ...(priceWhere.price || {}), [Op.lte]: parseFloat(maxPrice) };
      variantInclude.where    = priceWhere;
      variantInclude.required = true;
    }

    let order = [['createdAt', 'DESC']];
    if (sort === 'popular')    order = [['soldCount', 'DESC']];
    else if (sort === 'rating') order = [['rating', 'DESC']];
    else if (sort === 'price-asc')  order = [[{ model: ProductVariant, as: 'variants' }, 'price', 'ASC']];
    else if (sort === 'price-desc') order = [[{ model: ProductVariant, as: 'variants' }, 'price', 'DESC']];

    const { count: total, rows: products } = await Product.findAndCountAll({
      where,
      include: [variantInclude],
      order,
      limit:  parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      distinct: true,
    });

    res.json({ success: true, products, total, pages: Math.ceil(total / limit), page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/products/featured
router.get('/featured', async (req, res) => {
  try {
    const products = await Product.findAll({
      where: { isFeatured: true, isActive: true },
      include: [{ model: ProductVariant, as: 'variants' }],
      limit: 8,
    });
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/products/:slug/related
router.get('/:slug/related', async (req, res) => {
  try {
    const product = await Product.findOne({ where: { slug: req.params.slug, isActive: true } });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const related = await Product.findAll({
      where: { isActive: true, category: product.category, id: { [Op.ne]: product.id } },
      include: [{ model: ProductVariant, as: 'variants' }],
      limit: 6,
    });
    res.json({ success: true, products: related });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/products/:slug
router.get('/:slug', async (req, res) => {
  try {
    const product = await Product.findOne({
      where: { slug: req.params.slug, isActive: true },
      include: [
        { model: ProductVariant, as: 'variants' },
        { model: ProductReview,  as: 'reviews' },
      ],
    });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/products/:id/review
router.post('/:id/review', protect, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const alreadyReviewed = await ProductReview.findOne({ where: { productId: product.id, userId: req.user.id } });
    if (alreadyReviewed) return res.status(400).json({ success: false, message: 'Already reviewed' });

    await ProductReview.create({ productId: product.id, userId: req.user.id, name: req.user.name, rating, comment });

    const reviews = await ProductReview.findAll({ where: { productId: product.id } });
    await product.update({
      rating:     reviews.reduce((a, r) => a + r.rating, 0) / reviews.length,
      numReviews: reviews.length,
    });

    res.json({ success: true, message: 'Review added' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/products — admin only
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { variants, ...productData } = req.body;
    const product = await Product.create(productData);
    if (variants?.length) {
      await ProductVariant.bulkCreate(variants.map((v) => ({ ...v, productId: product.id })));
    }
    const full = await Product.findByPk(product.id, { include: [{ model: ProductVariant, as: 'variants' }] });
    res.status(201).json({ success: true, product: full });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// @PUT /api/products/:id — admin only
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { variants, ...productData } = req.body;
    await Product.update(productData, { where: { id: req.params.id } });
    if (variants) {
      await ProductVariant.destroy({ where: { productId: req.params.id } });
      await ProductVariant.bulkCreate(variants.map((v) => ({ ...v, productId: req.params.id })));
    }
    const product = await Product.findByPk(req.params.id, { include: [{ model: ProductVariant, as: 'variants' }] });
    res.json({ success: true, product });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// @DELETE /api/products/:id — admin only (soft delete)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Product.update({ isActive: false }, { where: { id: req.params.id } });
    res.json({ success: true, message: 'Product deactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
