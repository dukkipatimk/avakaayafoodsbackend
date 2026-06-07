const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Order = sequelize.define('Order', {
  _id:             { type: DataTypes.VIRTUAL, get() { return this.id; } },
  orderNumber:     { type: DataTypes.STRING, unique: true },
  guestEmail:      { type: DataTypes.STRING },
  shippingAddress: { type: DataTypes.JSON },   // embedded object — no separate table
  billingAddress:  { type: DataTypes.JSON },   // null = same as shippingAddress
  shippingZone:    { type: DataTypes.ENUM('india', 'usa', 'uk', 'singapore', 'australia', 'malaysia', 'other') },
  shippingCost:    { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  shippingMethod:  { type: DataTypes.STRING, defaultValue: 'Avakaaya.com Delivery' },
  estimatedDelivery: { type: DataTypes.STRING },
  subtotal:        { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  discount:        { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  couponCode:      { type: DataTypes.STRING },
  tax:             { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  total:           { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  currency:        { type: DataTypes.STRING, defaultValue: 'INR' },
  paymentMethod:   { type: DataTypes.ENUM('icici', 'razorpay', 'cod', 'upi', 'cash', 'bank_transfer'), defaultValue: 'razorpay' },
  paymentStatus:   { type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'), defaultValue: 'pending' },
  paymentId:       { type: DataTypes.STRING },
  razorpayOrderId: { type: DataTypes.STRING },
  orderStatus:     {
    type: DataTypes.ENUM('awaiting_payment', 'placed', 'confirmed', 'processing', 'packed', 'shipped', 'out-for-delivery', 'delivered', 'cancelled', 'returned'),
    defaultValue: 'awaiting_payment',
  },
  trackingNumber:  { type: DataTypes.STRING },
  trackingUrl:     { type: DataTypes.STRING },
  notes:           { type: DataTypes.TEXT },
}, {
  tableName: 'orders',
  timestamps: true,
});

module.exports = Order;
