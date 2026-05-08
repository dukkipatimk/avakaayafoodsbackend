const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Product = sequelize.define('Product', {
  name:               { type: DataTypes.STRING, allowNull: false },
  slug:               { type: DataTypes.STRING, unique: true },
  description:        { type: DataTypes.TEXT, allowNull: false },
  shortDescription:   { type: DataTypes.TEXT },
  category:           { type: DataTypes.ENUM('pickles', 'powders', 'snacks', 'sweets', 'ghee', 'gift-hampers'), allowNull: false },
  subcategory:        { type: DataTypes.STRING },
  images:             { type: DataTypes.JSON, defaultValue: [] },
  thumbnail:          { type: DataTypes.STRING },
  ingredients:        { type: DataTypes.JSON, defaultValue: [] },
  shelfLife:          { type: DataTypes.STRING },
  allergens:          { type: DataTypes.JSON, defaultValue: [] },
  tags:               { type: DataTypes.JSON, defaultValue: [] },
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
