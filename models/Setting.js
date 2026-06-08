const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Generic key/value store for admin-configurable settings.
const Setting = sequelize.define('Setting', {
  key:   { type: DataTypes.STRING, allowNull: false, unique: true },
  value: { type: DataTypes.JSON },
}, {
  tableName: 'settings',
  timestamps: true,
});

module.exports = Setting;
