require('dotenv').config();
const sequelize = require('./config/db');
require('./models'); // register all models and associations

const createTables = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to MySQL');

    // Drops all tables and recreates them fresh.
    // Safe for initial setup; do NOT run this in production with live data.
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await sequelize.sync({ force: true });
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('✅ All tables created / updated:');
    const [tables] = await sequelize.query('SHOW TABLES');
    tables.forEach((row) => console.log('  -', Object.values(row)[0]));

    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating tables:', err.message);
    process.exit(1);
  }
};

createTables();
