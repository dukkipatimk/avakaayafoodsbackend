const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/db');

const User = sequelize.define('User', {
  _id:             { type: DataTypes.VIRTUAL, get() { return this.id; } },
  name:            { type: DataTypes.STRING, allowNull: false },
  email:           { type: DataTypes.STRING, allowNull: false, unique: true },
  phone:           { type: DataTypes.STRING },
  password:        { type: DataTypes.STRING, allowNull: false },
  role:            { type: DataTypes.ENUM('customer', 'admin', 'store_manager', 'super_admin'), defaultValue: 'customer' },
  isEmailVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
  isActive:        { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      user.password = await bcrypt.hash(user.password, 10);
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
  },
});

User.prototype.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = User;
