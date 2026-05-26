// Guarded, idempotent runtime migrations.
//
// Each migration:
//   1. Inspects current DB schema
//   2. Skips if already applied
//   3. Applies a minimal ALTER if needed
//
// Safe to call on every server boot. Logs success / skip / failure but does
// NOT crash the server if a migration fails — startup continues either way.

const { DataTypes } = require('sequelize');

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

async function migrateOrderItemBundles(sequelize) {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    const hasOrderItems = tables.some(table => String(table).toLowerCase() === 'order_items');
    if (!hasOrderItems) return { name: 'order_items hamper fields', status: 'skipped (table not yet created)' };

    const columns = await queryInterface.describeTable('order_items');
    const additions = [
      ['bundleId', { type: DataTypes.STRING }],
      ['bundleType', { type: DataTypes.STRING }],
      ['bundleLabel', { type: DataTypes.STRING }],
      ['customization', { type: DataTypes.JSON }],
    ];
    let applied = false;
    for (const [column, definition] of additions) {
      if (!columns[column]) {
        await queryInterface.addColumn('order_items', column, definition);
        applied = true;
      }
    }
    return { name: 'order_items hamper fields', status: applied ? 'applied' : 'already applied' };
  } catch (err) {
    return { name: 'order_items hamper fields', status: `failed: ${err.message}` };
  }
}

async function migrateLeadGeography(sequelize) {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const tables = (await queryInterface.showAllTables()).map(table => String(table).toLowerCase());
    const additions = [
      ['ipAddress', { type: DataTypes.STRING(80) }],
      ['country', { type: DataTypes.STRING(100) }],
      ['region', { type: DataTypes.STRING(120) }],
      ['city', { type: DataTypes.STRING(120) }],
    ];
    let applied = false;
    for (const table of ['lead_sessions', 'analytics_events']) {
      if (!tables.includes(table)) continue;
      const columns = await queryInterface.describeTable(table);
      for (const [column, definition] of additions) {
        if (!columns[column]) {
          await queryInterface.addColumn(table, column, definition);
          applied = true;
        }
      }
    }
    return { name: 'lead geography fields', status: applied ? 'applied' : 'already applied' };
  } catch (err) {
    return { name: 'lead geography fields', status: `failed: ${err.message}` };
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

// Rewrite product image URLs that contain "localhost" so the live site can
// load them. Runs on every boot but only does work when BACKEND_URL is set
// AND a localhost URL is actually present.
async function fixLocalhostImageUrls() {
  try {
    const backend = (process.env.BACKEND_URL || '').replace(/\/$/, '');
    if (!backend) return { name: 'image URL fix', status: 'skipped (set BACKEND_URL env to enable)' };

    const { Product } = require('../models');
    const localhostRe = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i;

    const products = await Product.findAll({ attributes: ['id', 'thumbnail', 'images'] });
    let fixed = 0;
    for (const p of products) {
      const updates = {};
      if (p.thumbnail && localhostRe.test(p.thumbnail)) {
        updates.thumbnail = p.thumbnail.replace(localhostRe, backend);
      }
      const imgs = Array.isArray(p.images) ? p.images : [];
      const rewritten = imgs.map((u) => (u && localhostRe.test(u) ? u.replace(localhostRe, backend) : u));
      if (JSON.stringify(rewritten) !== JSON.stringify(imgs)) {
        updates.images = rewritten;
      }
      if (Object.keys(updates).length) {
        await p.update(updates);
        fixed++;
      }
    }
    return {
      name: 'image URL fix',
      status: fixed > 0 ? `applied (${fixed} product${fixed === 1 ? '' : 's'} rewritten)` : 'no localhost URLs found',
    };
  } catch (err) {
    return { name: 'image URL fix', status: `failed: ${err.message}` };
  }
}

async function runMigrations(sequelize) {
  const results = [];
  results.push(await migrateOrderStatusEnum(sequelize));
  results.push(await migrateUserRoleEnum(sequelize));
  results.push(await migrateOrderItemBundles(sequelize));
  results.push(await migrateLeadGeography(sequelize));
  results.push(await seedDefaultStores());
  results.push(await fixLocalhostImageUrls());
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
