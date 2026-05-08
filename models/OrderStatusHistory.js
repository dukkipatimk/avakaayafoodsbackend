const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const OrderStatusHistory = sequelize.define('OrderStatusHistory', {
  status:    { type: DataTypes.STRING },
  note:      { type: DataTypes.STRING },
  timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'order_status_history',
  timestamps: false,
});

module.exports = OrderStatusHistory;
