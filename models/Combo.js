const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// A discounted bundle of products.
//   type 'fixed' — the customer buys exactly the items listed in ComboItem.
//   type 'pick'  — the customer chooses `pickCount` items from the ComboItem pool.
// Either way the bundle sells for `price`, which is enforced server-side at
// order creation; the client never gets to name the discount.
const Combo = sequelize.define('Combo', {
  _id:         { type: DataTypes.VIRTUAL, get() { return this.id; } },
  name:        { type: DataTypes.STRING, allowNull: false },
  slug:        { type: DataTypes.STRING, unique: true },
  subtitle:    { type: DataTypes.STRING },
  description: { type: DataTypes.TEXT },
  image:       { type: DataTypes.STRING },
  // Which part of the catalogue the bundle belongs to. Drives the card colour
  // on the storefront and lets combos be grouped alongside categories.
  category:    { type: DataTypes.STRING(60) },
  type:        { type: DataTypes.ENUM('fixed', 'pick'), defaultValue: 'fixed' },
  pickCount:   { type: DataTypes.INTEGER, defaultValue: 3 },
  price:       { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  isActive:    { type: DataTypes.BOOLEAN, defaultValue: true },
  sortOrder:   { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  tableName: 'combos',
  timestamps: true,
  hooks: {
    beforeValidate: (combo) => {
      if (!combo.slug && combo.name) {
        combo.slug = String(combo.name).toLowerCase().trim()
          .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
      }
    },
  },
});

module.exports = Combo;
