const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const OrderItem = sequelize.define('OrderItem', {
  name:          { type: DataTypes.STRING },
  image:         { type: DataTypes.STRING },
  variantWeight: { type: DataTypes.STRING },
  variantPrice:  { type: DataTypes.DECIMAL(10, 2) },
  quantity:      { type: DataTypes.INTEGER, allowNull: false },
  price:         { type: DataTypes.DECIMAL(10, 2), allowNull: false },
}, {
  tableName: 'order_items',
  timestamps: false,
});

module.exports = OrderItem;
