// Guarded, idempotent runtime migrations.
//
// Each migration:
//   1. Inspects current DB schema
//   2. Skips if already applied
//   3. Applies a minimal ALTER if needed
//
// Safe to call on every server boot. Logs success / skip / failure but does
// NOT crash the server if a migration fails — startup continues either way.

const { DataTypes, Op } = require('sequelize');

// Normalize an entry from queryInterface.showAllTables() to a lowercase table
// name. Depending on the MySQL/Sequelize version this returns either an array of
// plain strings OR an array of { tableName, schema } objects. The old code did
// String(table).toLowerCase(), which silently turned an object into
// "[object object]" — so table-existence checks always failed and the guarded
// migrations skipped without ever adding their columns. Handle both shapes.
function tableNameOf(table) {
  const name = table && typeof table === 'object' ? (table.tableName || table.name) : table;
  return String(name || '').toLowerCase();
}

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
    const hasOrderItems = tables.some(table => tableNameOf(table) === 'order_items');
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
    const tables = (await queryInterface.showAllTables()).map(tableNameOf);
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

async function cleanupAdminTracking() {
  try {
    const { AnalyticsEvent, LeadSession, User } = require('../models');
    const staffUsers = await User.findAll({
      where: { role: { [Op.in]: ['admin', 'store_manager'] } },
      attributes: ['id'],
    });
    const staffIds = staffUsers.map((user) => user.id);
    const eventClauses = [{ path: { [Op.like]: '/admin%' } }];
    if (staffIds.length) eventClauses.push({ userId: { [Op.in]: staffIds } });

    const adminEvents = await AnalyticsEvent.findAll({
      attributes: ['sessionId'],
      where: { [Op.or]: eventClauses },
    });
    const adminEventSessions = adminEvents.map((event) => event.sessionId).filter(Boolean);

    const leadClauses = [{ lastPath: { [Op.like]: '/admin%' } }];
    if (staffIds.length) leadClauses.push({ userId: { [Op.in]: staffIds } });
    if (adminEventSessions.length) leadClauses.push({ sessionId: { [Op.in]: adminEventSessions } });

    const adminLeads = await LeadSession.findAll({
      attributes: ['sessionId'],
      where: { [Op.or]: leadClauses },
    });
    const sessionIds = Array.from(new Set([
      ...adminEventSessions,
      ...adminLeads.map((lead) => lead.sessionId).filter(Boolean),
    ]));

    const eventDeleteClauses = [...eventClauses];
    if (sessionIds.length) eventDeleteClauses.push({ sessionId: { [Op.in]: sessionIds } });

    const eventsDeleted = await AnalyticsEvent.destroy({ where: { [Op.or]: eventDeleteClauses } });
    const leadsDeleted = await LeadSession.destroy({ where: { [Op.or]: leadClauses } });

    if (eventsDeleted || leadsDeleted) {
      return {
        name: 'admin tracking cleanup',
        status: `applied (${eventsDeleted} event${eventsDeleted === 1 ? '' : 's'}, ${leadsDeleted} lead${leadsDeleted === 1 ? '' : 's'} removed)`,
      };
    }
    return { name: 'admin tracking cleanup', status: 'already clean' };
  } catch (err) {
    return { name: 'admin tracking cleanup', status: `failed: ${err.message}` };
  }
}

async function migrateStoreStatusOverride(sequelize) {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const tables = (await queryInterface.showAllTables()).map(tableNameOf);
    if (!tables.includes('stores')) return { name: 'stores.statusOverride', status: 'skipped (table not yet created)' };

    const columns = await queryInterface.describeTable('stores');
    if (columns.statusOverride) return { name: 'stores.statusOverride', status: 'already applied' };

    await queryInterface.addColumn('stores', 'statusOverride', {
      type: DataTypes.ENUM('auto', 'open', 'closed', 'coming_soon'),
      allowNull: false,
      defaultValue: 'auto',
    });
    return { name: 'stores.statusOverride', status: 'applied' };
  } catch (err) {
    return { name: 'stores.statusOverride', status: `failed: ${err.message}` };
  }
}

// Extend orders.paymentMethod enum with manual options (cash, bank_transfer).
async function migrateOrderPaymentMethodEnum(sequelize) {
  try {
    const [rows] = await sequelize.query(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'orders'
         AND COLUMN_NAME = 'paymentMethod'`
    );
    if (!rows.length) return { name: 'orders.paymentMethod', status: 'skipped (table not yet created)' };

    const colType = (rows[0].COLUMN_TYPE || '').toLowerCase();
    if (colType.includes("'cash'") && colType.includes("'bank_transfer'")) {
      return { name: 'orders.paymentMethod', status: 'already applied' };
    }
    await sequelize.query(
      `ALTER TABLE orders MODIFY COLUMN paymentMethod
       ENUM('icici','razorpay','cod','upi','cash','bank_transfer')
       DEFAULT 'razorpay'`
    );
    return { name: 'orders.paymentMethod', status: 'applied' };
  } catch (err) {
    return { name: 'orders.paymentMethod', status: `failed: ${err.message}` };
  }
}

// Add the orders.billingAddress JSON column (null = billing same as shipping).
async function migrateOrderBillingAddress(sequelize) {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const tables = (await queryInterface.showAllTables()).map(tableNameOf);
    if (!tables.includes('orders')) return { name: 'orders.billingAddress', status: 'skipped (table not yet created)' };

    const columns = await queryInterface.describeTable('orders');
    if (columns.billingAddress) return { name: 'orders.billingAddress', status: 'already applied' };

    await queryInterface.addColumn('orders', 'billingAddress', {
      type: DataTypes.JSON,
      allowNull: true,
    });
    return { name: 'orders.billingAddress', status: 'applied' };
  } catch (err) {
    return { name: 'orders.billingAddress', status: `failed: ${err.message}` };
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

// Post-migration sanity check: for every registered model, compare the columns
// it expects against the columns that actually exist in its table. Any mismatch
// means an INSERT/UPDATE touching that column will fail at runtime with
// "Unknown column 'X'" — exactly the kind of silent schema drift that causes a
// blanket 500 on order creation. We only log here (never throw): the goal is to
// make the problem loud and obvious in the boot logs, not to crash startup.
async function verifyModelColumns(sequelize) {
  const problems = [];
  try {
    const queryInterface = sequelize.getQueryInterface();
    const existingTables = (await queryInterface.showAllTables()).map(tableNameOf);
    const models = sequelize.models || {};

    for (const modelName of Object.keys(models)) {
      const model = models[modelName];
      const table = tableNameOf(model.getTableName());
      if (!existingTables.includes(table)) continue; // not created yet — sync handles fresh installs

      let dbColumns;
      try {
        dbColumns = Object.keys(await queryInterface.describeTable(model.getTableName()));
      } catch {
        continue;
      }
      const dbLower = dbColumns.map((c) => c.toLowerCase());

      for (const attr of Object.keys(model.rawAttributes)) {
        const def = model.rawAttributes[attr];
        // Skip VIRTUAL fields — they have no backing column.
        if (def.type && def.type.constructor && def.type.constructor.name === 'VIRTUAL') continue;
        const columnName = def.field || attr;
        if (!dbLower.includes(columnName.toLowerCase())) {
          problems.push(`${table}.${columnName} (model ${modelName})`);
        }
      }
    }
  } catch (err) {
    console.warn(`Column self-check could not run: ${err.message}`);
    return;
  }

  if (problems.length) {
    console.warn('⚠️  SCHEMA DRIFT — model columns missing from the database:');
    problems.forEach((p) => console.warn(`  • ${p}`));
    console.warn('   Writes touching these columns will fail with "Unknown column". Add a migration in utils/migrations.js.');
  } else {
    console.log('Schema self-check: all model columns present');
  }
}

async function runMigrations(sequelize) {
  const results = [];
  results.push(await migrateOrderStatusEnum(sequelize));
  results.push(await migrateUserRoleEnum(sequelize));
  results.push(await migrateOrderItemBundles(sequelize));
  results.push(await migrateLeadGeography(sequelize));
  results.push(await cleanupAdminTracking());
  results.push(await migrateStoreStatusOverride(sequelize));
  results.push(await migrateOrderPaymentMethodEnum(sequelize));
  results.push(await migrateOrderBillingAddress(sequelize));
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

  await verifyModelColumns(sequelize);
}

module.exports = { runMigrations };
