const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ProductReview = sequelize.define('ProductReview', {
  name:    { type: DataTypes.STRING },
  rating:  { type: DataTypes.INTEGER, allowNull: false },
  comment: { type: DataTypes.TEXT },
}, {
  tableName: 'product_reviews',
  timestamps: true,
});

module.exports = ProductReview;
