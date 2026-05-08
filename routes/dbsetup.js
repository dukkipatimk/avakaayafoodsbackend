const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const { recreateTables, seedProducts } = require('../seed');

// All endpoints require admin login
router.use(protect, adminOnly);

// @POST /api/dbsetup/create-tables
// Drops and recreates all tables from Sequelize model definitions.
router.post('/create-tables', async (req, res) => {
  try {
    const tables = await recreateTables();
    res.json({ success: true, message: `${tables.length} tables created`, tables });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/dbsetup/seed-products
// Clears products + variants and reloads from seed data. Also ensures admin user exists.
router.post('/seed-products', async (req, res) => {
  try {
    const count = await seedProducts();
    res.json({ success: true, message: `Seeded ${count} products`, count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/dbsetup/reset
// Convenience: recreate tables then seed products in one call.
router.post('/reset', async (req, res) => {
  try {
    const tables = await recreateTables();
    const count  = await seedProducts();
    res.json({ success: true, message: `Reset complete — ${tables.length} tables, ${count} products`, tables, count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
