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

async function runMigrations(sequelize) {
  const results = [];
  results.push(await migrateOrderStatusEnum(sequelize));
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
