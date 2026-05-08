const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const CouponUsedBy = sequelize.define('CouponUsedBy', {
  orderId: { type: DataTypes.STRING },
}, {
  tableName: 'coupon_used_by',
  timestamps: false,
});

module.exports = CouponUsedBy;
