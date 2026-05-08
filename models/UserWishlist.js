const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Junction table: user_id <-> product_id
const UserWishlist = sequelize.define('UserWishlist', {}, {
  tableName: 'user_wishlist',
  timestamps: false,
});

module.exports = UserWishlist;
