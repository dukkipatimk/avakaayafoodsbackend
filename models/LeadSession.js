const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const LeadSession = sequelize.define('LeadSession', {
  _id:           { type: DataTypes.VIRTUAL, get() { return this.id; } },
  sessionId:     { type: DataTypes.STRING(80), allowNull: false, unique: true },
  userId:        { type: DataTypes.INTEGER },
  name:          { type: DataTypes.STRING },
  email:         { type: DataTypes.STRING },
  phone:         { type: DataTypes.STRING },
  ipAddress:     { type: DataTypes.STRING(80) },
  country:       { type: DataTypes.STRING(100) },
  region:        { type: DataTypes.STRING(120) },
  city:          { type: DataTypes.STRING(120) },
  status:        { type: DataTypes.ENUM('active', 'hot', 'abandoned', 'converted', 'dismissed'), defaultValue: 'active' },
  stage:         { type: DataTypes.ENUM('browsing', 'cart', 'checkout', 'order'), defaultValue: 'browsing' },
  score:         { type: DataTypes.INTEGER, defaultValue: 0 },
  eventCount:    { type: DataTypes.INTEGER, defaultValue: 0 },
  productViews:  { type: DataTypes.INTEGER, defaultValue: 0 },
  cartAdds:      { type: DataTypes.INTEGER, defaultValue: 0 },
  cartValue:     { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  cartItems:     { type: DataTypes.JSON },
  lastPath:      { type: DataTypes.STRING },
  lastEventType: { type: DataTypes.STRING },
  lastEventAt:   { type: DataTypes.DATE },
  alertSentAt:   { type: DataTypes.DATE },
  orderId:       { type: DataTypes.INTEGER },
  source:        { type: DataTypes.STRING },
}, {
  tableName: 'lead_sessions',
  timestamps: true,
  indexes: [
    { fields: ['status', 'lastEventAt'] },
    { fields: ['email'] },
    { fields: ['phone'] },
  ],
});

module.exports = LeadSession;
