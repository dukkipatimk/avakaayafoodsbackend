const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Some legacy rows store JSON array columns as raw strings; always hand back an array.
const jsonArray = (field) => ({
  type: DataTypes.JSON,
  defaultValue: [],
  get() {
    const v = this.getDataValue(field);
    if (typeof v === 'string') {
      try { return JSON.parse(v); } catch { return []; }
    }
    return Array.isArray(v) ? v : [];
  },
});

const Product = sequelize.define('Product', {
  _id:                { type: DataTypes.VIRTUAL, get() { return this.id; } },
  name:               { type: DataTypes.STRING, allowNull: false },
  slug:               { type: DataTypes.STRING, unique: true },
  description:        { type: DataTypes.TEXT, allowNull: false },
  shortDescription:   { type: DataTypes.TEXT },
  category:           { type: DataTypes.ENUM('pickles', 'powders', 'snacks', 'sweets', 'ghee', 'gift-hampers'), allowNull: false },
  subcategory:        { type: DataTypes.STRING },
  images:             jsonArray('images'),
  thumbnail:          { type: DataTypes.STRING },
  ingredients:        jsonArray('ingredients'),
  shelfLife:          { type: DataTypes.STRING },
  allergens:          jsonArray('allergens'),
  tags:               jsonArray('tags'),
  isVeg:              { type: DataTypes.BOOLEAN, defaultValue: true },
  isFeatured:         { type: DataTypes.BOOLEAN, defaultValue: false },
  isActive:           { type: DataTypes.BOOLEAN, defaultValue: true },
  shippingType:       { type: DataTypes.ENUM('standard', 'international', 'both'), defaultValue: 'both' },
  weight_for_shipping:{ type: DataTypes.INTEGER },
  rating:             { type: DataTypes.FLOAT, defaultValue: 0 },
  numReviews:         { type: DataTypes.INTEGER, defaultValue: 0 },
  soldCount:          { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  tableName: 'products',
  timestamps: true,
  hooks: {
    beforeCreate: (product) => {
      if (!product.slug) {
        product.slug = product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      }
    },
  },
});

module.exports = Product;
