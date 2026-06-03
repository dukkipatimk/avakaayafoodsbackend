const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Store = sequelize.define('Store', {
  _id:       { type: DataTypes.VIRTUAL, get() { return this.id; } },
  name:      { type: DataTypes.STRING, allowNull: false },
  area:      { type: DataTypes.STRING },                              // locality, e.g. "KPHB, Kukatpally"
  address:   { type: DataTypes.TEXT },
  city:      { type: DataTypes.STRING, defaultValue: 'Hyderabad' },
  state:     { type: DataTypes.STRING, defaultValue: 'Telangana' },
  phone:     { type: DataTypes.STRING },
  hours:     { type: DataTypes.STRING },                              // e.g. "9 AM – 9 PM"
  statusOverride: { type: DataTypes.ENUM('auto', 'open', 'closed', 'coming_soon'), defaultValue: 'auto' },
  mapUrl:    { type: DataTypes.STRING },                              // Google Maps link
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
  isActive:  { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'stores',
  timestamps: true,
});

module.exports = Store;
