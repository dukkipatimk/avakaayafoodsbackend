const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Coupon = sequelize.define('Coupon', {
  code:         { type: DataTypes.STRING, allowNull: false, unique: true },
  type:         { type: DataTypes.ENUM('percent', 'flat'), defaultValue: 'percent' },
  value:        { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  minOrder:     { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  maxDiscount:  { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  usageLimit:   { type: DataTypes.INTEGER, defaultValue: 0 },
  usageCount:   { type: DataTypes.INTEGER, defaultValue: 0 },
  perUserLimit: { type: DataTypes.INTEGER, defaultValue: 1 },
  expiresAt:    { type: DataTypes.DATE },
  isActive:     { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'coupons',
  timestamps: true,
  hooks: {
    beforeCreate: (coupon) => {
      coupon.code = coupon.code.toUpperCase().trim();
    },
  },
});

module.exports = Coupon;
