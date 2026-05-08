const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  weight: {
    type: String,
    enum: ['100g', '200g', '250g', '500g', '1kg'],
    required: true
  },
  price: { type: Number, required: true },
  mrp: { type: Number, required: true },
  stock: { type: Number, default: 100 },
  sku: { type: String }
});

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: String,
  createdAt: { type: Date, default: Date.now }
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true, lowercase: true },
  description: { type: String, required: true },
  shortDescription: { type: String },
  category: {
    type: String,
    enum: ['pickles', 'powders', 'snacks', 'sweets', 'ghee', 'gift-hampers'],
    required: true
  },
  subcategory: { type: String },
  images: [{ type: String }],
  thumbnail: { type: String },
  variants: [variantSchema],
  ingredients: [{ type: String }],
  shelfLife: { type: String },
  allergens: [{ type: String }],
  tags: [{ type: String }],
  isVeg: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  shippingType: {
    type: String,
    enum: ['standard', 'international', 'both'],
    default: 'both'
  },
  weight_for_shipping: { type: Number }, // in grams
  reviews: [reviewSchema],
  rating: { type: Number, default: 0 },
  numReviews: { type: Number, default: 0 },
  soldCount: { type: Number, default: 0 }
}, { timestamps: true });

// Text index for search
productSchema.index(
  { name: 'text', shortDescription: 'text', description: 'text', tags: 'text' },
  { weights: { name: 10, shortDescription: 5, tags: 5, description: 1 }, name: 'product_text_search' }
);

// Generate slug from name
productSchema.pre('save', function(next) {
  if (!this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  if (this.reviews.length > 0) {
    this.rating = this.reviews.reduce((acc, r) => acc + r.rating, 0) / this.reviews.length;
    this.numReviews = this.reviews.length;
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);
