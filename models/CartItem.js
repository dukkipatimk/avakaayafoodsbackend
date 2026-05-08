const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const CartItem = sequelize.define('CartItem', {
  weight:   { type: DataTypes.STRING },
  quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
  price:    { type: DataTypes.DECIMAL(10, 2) },
}, {
  tableName: 'cart_items',
  timestamps: false,
});

module.exports = CartItem;
