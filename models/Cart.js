const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Cart = sequelize.define('Cart', {}, {
  tableName: 'carts',
  timestamps: true,
});

module.exports = Cart;
