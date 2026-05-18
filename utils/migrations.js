// Guarded, idempotent runtime migrations.
//
// Each migration:
//   1. Inspects current DB schema
//   2. Skips if already applied
//   3. Applies a minimal ALTER if needed
//
// Safe to call on every server boot. Logs success / skip / failure but does
// NOT crash the server if a migration fails — startup continues either way.

const ORDER_STATUS_VALUES = [
  'awaiting_payment',
  'placed',
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'out-for-delivery',
  'delivered',
  'cancelled',
  'returned',
];

async function migrateOrderStatusEnum(sequelize) {
  try {
    const [rows] = await sequelize.query(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'orders'
         AND COLUMN_NAME = 'orderStatus'`
    );
    if (!rows.length) {
      // Fresh install — sequelize.sync() will create the table with the
      // current model definition (which already includes awaiting_payment).
      return { name: 'orders.orderStatus', status: 'skipped (table not yet created)' };
    }

    const colType = (rows[0].COLUMN_TYPE || '').toLowerCase();
    if (colType.includes("'awaiting_payment'")) {
      return { name: 'orders.orderStatus', status: 'already applied' };
    }

    const enumList = ORDER_STATUS_VALUES.map((v) => `'${v}'`).join(',');
    await sequelize.query(
      `ALTER TABLE orders MODIFY COLUMN orderStatus
       ENUM(${enumList})
       DEFAULT 'awaiting_payment'`
    );
    return { name: 'orders.orderStatus', status: 'applied' };
  } catch (err) {
    return { name: 'orders.orderStatus', status: `failed: ${err.message}` };
  }
}

async function migrateUserRoleEnum(sequelize) {
  try {
    const [rows] = await sequelize.query(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND COLUMN_NAME = 'role'`
    );
    if (!rows.length) {
      // Fresh install — sequelize.sync() creates the table with the current
      // model definition (which already includes store_manager).
      return { name: 'users.role', status: 'skipped (table not yet created)' };
    }

    const colType = (rows[0].COLUMN_TYPE || '').toLowerCase();
    if (colType.includes("'store_manager'")) {
      return { name: 'users.role', status: 'already applied' };
    }

    await sequelize.query(
      `ALTER TABLE users MODIFY COLUMN role
       ENUM('customer','admin','store_manager')
       DEFAULT 'customer'`
    );
    return { name: 'users.role', status: 'applied' };
  } catch (err) {
    return { name: 'users.role', status: `failed: ${err.message}` };
  }
}

// Seed the three known retail stores the first time the table is created,
// so the storefront has data out of the box. Admins can edit them afterwards.
async function seedDefaultStores() {
  try {
    const { Store } = require('../models');
    const count = await Store.count();
    if (count > 0) return { name: 'stores seed', status: 'skipped (already populated)' };
    await Store.bulkCreate([
      { name: 'KPHB Store',         area: 'KPHB, Kukatpally', city: 'Hyderabad', state: 'Telangana', sortOrder: 1 },
      { name: 'Chandanagar Store',  area: 'Chandanagar',      city: 'Hyderabad', state: 'Telangana', sortOrder: 2 },
      { name: 'Chintal Store',      area: 'Chintal',          city: 'Hyderabad', state: 'Telangana', sortOrder: 3 },
    ]);
    return { name: 'stores seed', status: 'applied (3 default stores)' };
  } catch (err) {
    return { name: 'stores seed', status: `failed: ${err.message}` };
  }
}

async function runMigrations(sequelize) {
  const results = [];
  results.push(await migrateOrderStatusEnum(sequelize));
  results.push(await migrateUserRoleEnum(sequelize));
  results.push(await seedDefaultStores());
  // Add future migrations here, e.g.
  //   results.push(await migrateXyz(sequelize));

  const applied = results.filter((r) => r.status === 'applied');
  const failed  = results.filter((r) => r.status.startsWith('failed'));

  if (applied.length) {
    console.log(`Migrations applied: ${applied.map((r) => r.name).join(', ')}`);
  } else if (failed.length === 0) {
    console.log('Migrations: all up to date');
  }
  if (failed.length) {
    console.warn(`Migrations failed (server continues):`);
    failed.forEach((r) => console.warn(`  • ${r.name} — ${r.status}`));
  }
}

module.exports = { runMigrations };
