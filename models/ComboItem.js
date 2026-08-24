const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// A member of a combo. For 'fixed' combos these are the exact items shipped;
// for 'pick' combos they are the pool the customer chooses from.
const ComboItem = sequelize.define('ComboItem', {
  _id:       { type: DataTypes.VIRTUAL, get() { return this.id; } },
  weight:    { type: DataTypes.STRING, allowNull: false },   // which variant of the product
  quantity:  { type: DataTypes.INTEGER, defaultValue: 1 },   // only meaningful for 'fixed'
}, {
  tableName: 'combo_items',
  timestamps: false,
});

module.exports = ComboItem;
