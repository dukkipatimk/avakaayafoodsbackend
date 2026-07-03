const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const {
  Order, OrderItem, OrderStatusHistory, Product, ProductVariant, User, LeadSession,
} = require('../models');
const { protect, superAdminOnly } = require('../middleware/auth');

// All reports are financial/super-admin only.
router.use(protect, superAdminOnly);

// ── Date bucketing ───────────────────────────────────────────────────────────
// createdAt is stored in UTC. The business runs in IST, so bucket by a shifted
// clock (override with REPORT_TZ_OFFSET_MIN) to get correct day/week/month
// boundaries for an India storefront.
const TZ_OFFSET_MIN = Number(process.env.REPORT_TZ_OFFSET_MIN || 330); // IST
const shift = (d) => new Date(new Date(d).getTime() + TZ_OFFSET_MIN * 60000);
const dayKey = (d) => shift(d).toISOString().slice(0, 10);              // YYYY-MM-DD
const monthKey = (d) => dayKey(d).slice(0, 7) + '-01';                  // YYYY-MM-01
function weekKey(d) {                                                   // Monday of the week
  const x = shift(d);
  const dow = x.getUTCDay();                 // 0=Sun … 6=Sat (on the shifted clock)
  const diff = dow === 0 ? 6 : dow - 1;
  const mon = new Date(x.getTime() - diff * 86400000);
  return mon.toISOString().slice(0, 10);
}
const bucketKey = (d, period) =>
  period === 'monthly' ? monthKey(d) : period === 'weekly' ? weekKey(d) : dayKey(d);

const REAL = { [Op.ne]: 'awaiting_payment' };   // orderStatus filter for "real" orders
// A "sale" excludes abandoned checkouts AND cancelled/returned orders.
const SALES = { [Op.notIn]: ['awaiting_payment', 'cancelled', 'returned'] };
const num = (v) => Number(v) || 0;

// Start/end calendar dates (YYYY-MM-DD) for a bucket key, per period.
function bucketBounds(key, period) {
  if (period === 'weekly') {
    const s = new Date(key + 'T00:00:00Z');
    const e = new Date(s.getTime() + 6 * 86400000);         // Monday + 6 = Sunday
    return { start: key, end: e.toISOString().slice(0, 10) };
  }
  if (period === 'monthly') {
    const s = new Date(key + 'T00:00:00Z');                 // YYYY-MM-01
    const e = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 0)); // last day of month
    return { start: key, end: e.toISOString().slice(0, 10) };
  }
  return { start: key, end: key };
}

// Resolve a date range from the query; sensible default window per period.
function parseRange(req, period) {
  const to = req.query.to ? new Date(req.query.to) : new Date();
  let from;
  if (req.query.from) {
    from = new Date(req.query.from);
  } else {
    from = new Date(to);
    if (period === 'monthly') from.setMonth(from.getMonth() - 11);       // last 12 months
    else if (period === 'weekly') from.setDate(from.getDate() - 7 * 11); // last 12 weeks
    else from.setDate(from.getDate() - 29);                              // last 30 days
    from.setHours(0, 0, 0, 0);
  }
  return { from, to };
}

// Build a userId lookup so guest orders/leads can be attributed to an account.
async function emailToIdMap() {
  const users = await User.findAll({ attributes: ['id', 'email'], raw: true });
  const map = {};
  users.forEach((u) => { if (u.email) map[String(u.email).toLowerCase()] = u.id; });
  return map;
}

// ── 1) Sales over time (daily / weekly / monthly) ────────────────────────────
router.get('/sales', async (req, res) => {
  try {
    const period = ['daily', 'weekly', 'monthly'].includes(req.query.period) ? req.query.period : 'daily';
    const { from, to } = parseRange(req, period);

    const orders = await Order.findAll({
      where: { orderStatus: SALES, createdAt: { [Op.between]: [from, to] } },
      attributes: ['id', 'createdAt', 'total', 'paymentStatus'],
      raw: true,
    });
    const ids = orders.map((o) => o.id);
    const itemRows = ids.length
      ? await OrderItem.findAll({ where: { orderId: ids }, attributes: ['orderId', 'quantity'], raw: true })
      : [];
    const qtyByOrder = {};
    itemRows.forEach((r) => { qtyByOrder[r.orderId] = (qtyByOrder[r.orderId] || 0) + num(r.quantity); });

    const buckets = {};
    let tRevenue = 0, tOrders = 0, tPaid = 0, tItems = 0;
    for (const o of orders) {
      const key = bucketKey(o.createdAt, period);
      const b = buckets[key] || (buckets[key] = { bucket: key, orders: 0, paidOrders: 0, revenue: 0, itemsSold: 0 });
      const paid = o.paymentStatus === 'paid';
      const rev = paid ? num(o.total) : 0;
      const qty = qtyByOrder[o.id] || 0;
      b.orders += 1; tOrders += 1;
      if (paid) { b.paidOrders += 1; tPaid += 1; }
      b.revenue += rev; tRevenue += rev;
      b.itemsSold += qty; tItems += qty;
    }
    const rows = Object.values(buckets)
      .map((b) => ({ ...b, ...bucketBounds(b.bucket, period), aov: b.paidOrders ? Math.round(b.revenue / b.paidOrders) : 0 }))
      .sort((a, b) => b.bucket.localeCompare(a.bucket));   // newest first

    // Previous equal-length window for % change.
    const span = to.getTime() - from.getTime();
    const prev = await Order.findAll({
      where: { orderStatus: SALES, paymentStatus: 'paid', createdAt: { [Op.between]: [new Date(from.getTime() - span), from] } },
      attributes: ['total'], raw: true,
    });
    const prevRevenue = prev.reduce((s, o) => s + num(o.total), 0);
    const prevOrders = prev.length;

    res.json({
      success: true,
      period, from, to,
      buckets: rows,
      totals: { revenue: tRevenue, orders: tOrders, paidOrders: tPaid, itemsSold: tItems, aov: tPaid ? Math.round(tRevenue / tPaid) : 0 },
      previous: { revenue: prevRevenue, orders: prevOrders },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Order-level drill-down for any date window ───────────────────────────────
router.get('/orders', async (req, res) => {
  try {
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date(to.getTime() - 86400000);
    const orders = await Order.findAll({
      where: { orderStatus: SALES, createdAt: { [Op.between]: [from, to] } },
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'user', attributes: ['name', 'email'], required: false },
        { model: OrderItem, as: 'items', attributes: ['quantity'] },
      ],
    });
    const rows = orders.map((o) => {
      const addr = o.shippingAddress || {};
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt,
        customer: o.user?.name || addr.fullName || addr.name || '—',
        email: o.user?.email || o.guestEmail || addr.email || '—',
        items: (o.items || []).reduce((n, i) => n + num(i.quantity), 0),
        total: num(o.total),
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        orderStatus: o.orderStatus,
        zone: o.shippingZone,
      };
    });
    res.json({ success: true, from, to, orders: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 2) Product performance ───────────────────────────────────────────────────
router.get('/products', async (req, res) => {
  try {
    const { from, to } = parseRange(req, 'daily');
    const orders = await Order.findAll({
      where: { orderStatus: REAL, createdAt: { [Op.between]: [from, to] } },
      attributes: ['id', 'paymentStatus'], raw: true,
    });
    const paidIds = new Set(orders.filter((o) => o.paymentStatus === 'paid').map((o) => o.id));
    const ids = orders.map((o) => o.id);
    const items = ids.length
      ? await OrderItem.findAll({
          where: { orderId: ids },
          attributes: ['orderId', 'productId', 'name', 'variantWeight', 'quantity', 'price', 'bundleType'],
          raw: true,
        })
      : [];
    const products = await Product.findAll({ attributes: ['id', 'category', 'isVeg'], raw: true });
    const prodMeta = {};
    products.forEach((p) => { prodMeta[p.id] = p; });

    const byProduct = {}, byCategory = {}, byVariant = {};
    let vegRev = 0, nonVegRev = 0, hamperQty = 0, hamperRev = 0;
    for (const it of items) {
      const paid = paidIds.has(it.orderId);
      const rev = paid ? num(it.price) : 0;
      const qty = num(it.quantity);

      const p = byProduct[it.name] || (byProduct[it.name] = { name: it.name, qty: 0, revenue: 0 });
      p.qty += qty; p.revenue += rev;

      const meta = prodMeta[it.productId];
      const cat = meta?.category || 'unknown';
      const c = byCategory[cat] || (byCategory[cat] = { category: cat, qty: 0, revenue: 0 });
      c.qty += qty; c.revenue += rev;

      const w = it.variantWeight || '—';
      const v = byVariant[w] || (byVariant[w] = { weight: w, qty: 0, revenue: 0 });
      v.qty += qty; v.revenue += rev;

      if (meta?.isVeg === false) nonVegRev += rev; else vegRev += rev;
      if (it.bundleType === 'hamper') { hamperQty += qty; hamperRev += rev; }
    }
    const bySales = (a, b) => b.revenue - a.revenue;
    const list = (o) => Object.values(o).sort(bySales);

    res.json({
      success: true, from, to,
      topProducts: list(byProduct).slice(0, 20),
      worstProducts: list(byProduct).slice(-10).reverse(),
      byCategory: list(byCategory),
      byVariant: list(byVariant),
      vegSplit: { veg: vegRev, nonVeg: nonVegRev },
      hampers: { qty: hamperQty, revenue: hamperRev },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 3) Customers & LTV ───────────────────────────────────────────────────────
router.get('/customers', async (req, res) => {
  try {
    const period = ['daily', 'weekly', 'monthly'].includes(req.query.period) ? req.query.period : 'monthly';
    const { from, to } = parseRange(req, period);
    const emailToId = await emailToIdMap();

    // All real orders (all time) — needed to know each customer's first-ever order.
    const all = await Order.findAll({
      where: { orderStatus: REAL },
      attributes: ['userId', 'guestEmail', 'total', 'paymentStatus', 'createdAt', 'shippingZone'],
      raw: true,
    });
    const keyOf = (o) => {
      if (o.userId) return `u:${o.userId}`;
      const uid = o.guestEmail && emailToId[String(o.guestEmail).toLowerCase()];
      return uid ? `u:${uid}` : (o.guestEmail ? `e:${String(o.guestEmail).toLowerCase()}` : null);
    };
    const firstOrderAt = {};
    for (const o of all) {
      const k = keyOf(o); if (!k) continue;
      const t = new Date(o.createdAt).getTime();
      if (!(k in firstOrderAt) || t < firstOrderAt[k]) firstOrderAt[k] = t;
    }

    const inRange = all.filter((o) => {
      const t = new Date(o.createdAt).getTime();
      return t >= from.getTime() && t <= to.getTime();
    });

    const byCustomer = {};
    const zone = {};
    let guestOrders = 0, regOrders = 0, guestRev = 0, regRev = 0;
    const newSet = new Set(), returningSet = new Set();
    for (const o of inRange) {
      const k = keyOf(o);
      const paid = o.paymentStatus === 'paid';
      const rev = paid ? num(o.total) : 0;
      if (k) {
        const c = byCustomer[k] || (byCustomer[k] = { key: k, orders: 0, revenue: 0 });
        c.orders += 1; c.revenue += rev;
        if ((firstOrderAt[k] || 0) >= from.getTime()) newSet.add(k); else returningSet.add(k);
      }
      if (o.userId || (o.guestEmail && emailToId[String(o.guestEmail).toLowerCase()])) { regOrders += 1; regRev += rev; }
      else { guestOrders += 1; guestRev += rev; }
      const z = o.shippingZone || 'other';
      const zr = zone[z] || (zone[z] = { zone: z, orders: 0, revenue: 0 });
      zr.orders += 1; zr.revenue += rev;
    }

    // Attach names/emails to the top customers.
    const userIds = Object.keys(byCustomer).filter((k) => k.startsWith('u:')).map((k) => Number(k.slice(2)));
    const userRows = userIds.length
      ? await User.findAll({ where: { id: userIds }, attributes: ['id', 'name', 'email'], raw: true })
      : [];
    const uMap = {};
    userRows.forEach((u) => { uMap[u.id] = u; });
    const topCustomers = Object.values(byCustomer).sort((a, b) => b.revenue - a.revenue).slice(0, 20)
      .map((c) => {
        if (c.key.startsWith('u:')) { const u = uMap[Number(c.key.slice(2))] || {}; return { name: u.name || '—', email: u.email || '—', orders: c.orders, revenue: c.revenue }; }
        return { name: '(guest)', email: c.key.slice(2), orders: c.orders, revenue: c.revenue };
      });

    // Registrations trend (customers created per bucket).
    const regs = await User.findAll({
      where: { role: 'customer', createdAt: { [Op.between]: [from, to] } },
      attributes: ['createdAt'], raw: true,
    });
    const regBuckets = {};
    regs.forEach((u) => { const k = bucketKey(u.createdAt, period); regBuckets[k] = (regBuckets[k] || 0) + 1; });
    const registrations = Object.entries(regBuckets).sort((a, b) => a[0].localeCompare(b[0])).map(([bucket, count]) => ({ bucket, count }));

    res.json({
      success: true, from, to, period,
      topCustomers,
      newVsReturning: { new: newSet.size, returning: returningSet.size },
      guestVsRegistered: { guestOrders, registeredOrders: regOrders, guestRevenue: guestRev, registeredRevenue: regRev },
      byZone: Object.values(zone).sort((a, b) => b.revenue - a.revenue),
      registrations,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 4) Funnel & abandoned checkout ───────────────────────────────────────────
router.get('/funnel', async (req, res) => {
  try {
    const { from, to } = parseRange(req, 'monthly');
    const leads = await LeadSession.findAll({
      where: { createdAt: { [Op.between]: [from, to] } },
      attributes: ['stage', 'status', 'cartValue', 'source', 'cartItems'],
      raw: true,
    });
    // A lead must have products in the cart; empty carts aren't leads.
    const cartLen = (v) => {
      if (Array.isArray(v)) return v.length;
      if (typeof v === 'string') { try { return (JSON.parse(v) || []).length; } catch { return 0; } }
      return 0;
    };
    const order = { browsing: 0, cart: 1, checkout: 2, order: 3 };
    let sessions = 0, reachedCart = 0, reachedCheckout = 0, reachedOrder = 0, converted = 0;
    let abandonedCount = 0, abandonedValue = 0;
    const bySource = {};
    for (const l of leads) {
      sessions += 1;
      const idx = order[l.stage] ?? 0;
      if (idx >= 1) reachedCart += 1;
      if (idx >= 2) reachedCheckout += 1;
      if (idx >= 3) reachedOrder += 1;
      if (l.status === 'converted') converted += 1;
      if (idx >= 2 && l.status !== 'converted' && cartLen(l.cartItems) > 0) { abandonedCount += 1; abandonedValue += num(l.cartValue); }
      const src = l.source || 'direct';
      const s = bySource[src] || (bySource[src] = { source: src, sessions: 0, converted: 0 });
      s.sessions += 1;
      if (l.status === 'converted') s.converted += 1;
    }
    const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
    res.json({
      success: true, from, to,
      funnel: [
        { stage: 'Sessions',        count: sessions,        ofPrev: 100 },
        { stage: 'Reached cart',    count: reachedCart,     ofPrev: pct(reachedCart, sessions) },
        { stage: 'Reached checkout',count: reachedCheckout, ofPrev: pct(reachedCheckout, reachedCart) },
        { stage: 'Placed order',    count: reachedOrder,    ofPrev: pct(reachedOrder, reachedCheckout) },
      ],
      conversionRate: pct(converted, reachedCheckout),
      abandoned: { count: abandonedCount, value: abandonedValue },
      bySource: Object.values(bySource).sort((a, b) => b.sessions - a.sessions),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 5) Operations, inventory & coupons ───────────────────────────────────────
router.get('/operations', async (req, res) => {
  try {
    const { from, to } = parseRange(req, 'monthly');

    // Orders by status (in range, all statuses incl. awaiting_payment).
    const ranged = await Order.findAll({
      where: { createdAt: { [Op.between]: [from, to] } },
      attributes: ['id', 'orderStatus', 'paymentMethod', 'paymentStatus', 'couponCode', 'total', 'discount', 'createdAt'],
      raw: true,
    });
    const byStatus = {};
    const couponPerf = {};
    for (const o of ranged) {
      byStatus[o.orderStatus] = (byStatus[o.orderStatus] || 0) + 1;
      if (o.couponCode) {
        const c = couponPerf[o.couponCode] || (couponPerf[o.couponCode] = { code: o.couponCode, uses: 0, revenue: 0, discount: 0 });
        c.uses += 1;
        if (o.paymentStatus === 'paid') c.revenue += num(o.total);
        c.discount += num(o.discount);
      }
    }

    // Actionable queues (current, all-time).
    const [awaitingPayment, upiAwaiting, toShip] = await Promise.all([
      Order.count({ where: { orderStatus: 'awaiting_payment' } }),
      Order.count({ where: { paymentMethod: 'upi', paymentStatus: 'pending', orderStatus: { [Op.notIn]: ['cancelled', 'returned', 'awaiting_payment'] } } }),
      Order.count({ where: { orderStatus: { [Op.in]: ['placed', 'confirmed', 'processing', 'packed'] } } }),
    ]);

    // Fulfilment SLA — from status history of orders delivered in range.
    const delivered = await Order.findAll({
      where: { orderStatus: 'delivered', createdAt: { [Op.between]: [from, to] } },
      attributes: ['id', 'createdAt'], raw: true,
    });
    let sumShip = 0, nShip = 0, sumDeliver = 0, nDeliver = 0;
    if (delivered.length) {
      const hist = await OrderStatusHistory.findAll({
        where: { orderId: delivered.map((o) => o.id), status: { [Op.in]: ['shipped', 'delivered'] } },
        attributes: ['orderId', 'status', 'timestamp'], raw: true,
      });
      const firstAt = {};
      hist.forEach((h) => {
        const t = new Date(h.timestamp).getTime();
        firstAt[h.orderId] = firstAt[h.orderId] || {};
        if (!firstAt[h.orderId][h.status] || t < firstAt[h.orderId][h.status]) firstAt[h.orderId][h.status] = t;
      });
      const placedAt = {};
      delivered.forEach((o) => { placedAt[o.id] = new Date(o.createdAt).getTime(); });
      for (const id of Object.keys(firstAt)) {
        const f = firstAt[id];
        if (f.shipped && placedAt[id]) { sumShip += (f.shipped - placedAt[id]); nShip += 1; }
        if (f.delivered && placedAt[id]) { sumDeliver += (f.delivered - placedAt[id]); nDeliver += 1; }
      }
    }
    const days = (ms) => Math.round((ms / 86400000) * 10) / 10;

    // Inventory: low stock (1–10) and out of stock, for active products.
    const variants = await ProductVariant.findAll({
      where: { stock: { [Op.lte]: 10 } },
      attributes: ['weight', 'stock', 'sku'],
      include: [{ model: Product, attributes: ['name', 'isActive'] }],
    });
    const lowStock = [], outOfStock = [];
    variants.forEach((v) => {
      if (!v.Product || v.Product.isActive === false) return;
      const row = { product: v.Product.name, weight: v.weight, stock: v.stock, sku: v.sku || '—' };
      (v.stock <= 0 ? outOfStock : lowStock).push(row);
    });

    res.json({
      success: true, from, to,
      ordersByStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      actionable: { awaitingPayment, upiAwaiting, toShip },
      fulfilment: { avgDaysToShip: nShip ? days(sumShip / nShip) : null, avgDaysToDeliver: nDeliver ? days(sumDeliver / nDeliver) : null, sample: nDeliver },
      inventory: { lowStock, outOfStock },
      coupons: Object.values(couponPerf).sort((a, b) => b.uses - a.uses),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
