const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const UserAddress = sequelize.define('UserAddress', {
  label:     { type: DataTypes.STRING, defaultValue: 'Home' },
  fullName:  { type: DataTypes.STRING },
  phone:     { type: DataTypes.STRING },
  line1:     { type: DataTypes.STRING },
  line2:     { type: DataTypes.STRING },
  city:      { type: DataTypes.STRING },
  state:     { type: DataTypes.STRING },
  pincode:   { type: DataTypes.STRING },
  country:   { type: DataTypes.STRING, defaultValue: 'India' },
  isDefault: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName: 'user_addresses',
  timestamps: false,
});

module.exports = UserAddress;
