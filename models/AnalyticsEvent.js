const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AnalyticsEvent = sequelize.define('AnalyticsEvent', {
  sessionId: { type: DataTypes.STRING(80), allowNull: false },
  userId:    { type: DataTypes.INTEGER },
  eventType: { type: DataTypes.STRING(40), allowNull: false },
  path:      { type: DataTypes.STRING },
  productId: { type: DataTypes.INTEGER },
  metadata:  { type: DataTypes.JSON },
}, {
  tableName: 'analytics_events',
  timestamps: true,
  indexes: [
    { fields: ['sessionId', 'createdAt'] },
    { fields: ['eventType', 'createdAt'] },
  ],
});

module.exports = AnalyticsEvent;
