const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ProductVariant = sequelize.define('ProductVariant', {
  weight: { type: DataTypes.ENUM('100g', '200g', '250g', '500g', '1kg'), allowNull: false },
  price:  { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  mrp:    { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  stock:  { type: DataTypes.INTEGER, defaultValue: 100 },
  sku:    { type: DataTypes.STRING },
}, {
  tableName: 'product_variants',
  timestamps: false,
});

module.exports = ProductVariant;
