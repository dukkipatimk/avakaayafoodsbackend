const { Op } = require('sequelize');
const { Order, OrderStatusHistory } = require('../models');

// ── What the shop took, and what actually arrived ───────────────────────────
//
// Two questions the orders screen could not answer: what each day was worth,
// and which orders are late. Both are computed here rather than in the browser
// because the screen only ever loads the most recent fifty orders, and a day's
// revenue counted from a page of fifty is a guess.
//
// LATE is a judgement the data does not record — there is no promised date on
// an order — so it is derived from where the order was going, using the
// delivery windows the storefront advertises:
//
//     India          2 days
//     everywhere else 7 days
//
// An order is late if it has not been delivered and that window has passed, or
// if it was delivered after it. Cancelled and returned orders are neither: they
// were never going to arrive.
const SLA_DAYS = { india: 2, default: 7 };
const DAY_MS = 24 * 60 * 60 * 1000;

const slaDays = (zone) => SLA_DAYS[String(zone || '').toLowerCase()] ?? SLA_DAYS.default;
const dueBy = (order) => new Date(new Date(order.createdAt).getTime() + slaDays(order.shippingZone) * DAY_MS);

// IST, because the business day is the one the shop keeps, not UTC's.
const istDate = (d) => new Date(new Date(d).getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

const DEAD = ['cancelled', 'returned'];
const money = (n) => Math.round(Number(n || 0) * 100) / 100;

// When an order reached 'delivered', from its status history. Null if it has
// not, or if history was never written for it.
const deliveredAtOf = (order) => {
  const hit = (order.statusHistory || [])
    .filter((h) => h.status === 'delivered')
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0];
  return hit ? new Date(hit.timestamp) : null;
};

const lateness = (order, now = new Date()) => {
  if (DEAD.includes(order.orderStatus)) return { late: false, daysLate: 0 };
  const due = dueBy(order);
  const delivered = order.orderStatus === 'delivered' ? (deliveredAtOf(order) || null) : null;
  if (order.orderStatus === 'delivered') {
    // Delivered, but was it on time? Without a history row we cannot say it was
    // late, and guessing would paint good deliveries red.
    if (!delivered) return { late: false, daysLate: 0, dueBy: due };
    const over = delivered - due;
    return { late: over > 0, daysLate: over > 0 ? Math.ceil(over / DAY_MS) : 0, dueBy: due, deliveredAt: delivered };
  }
  const over = now - due;
  return { late: over > 0, daysLate: over > 0 ? Math.ceil(over / DAY_MS) : 0, dueBy: due };
};

// @GET /api/orders/summary?days=14  (or ?from=YYYY-MM-DD&to=YYYY-MM-DD)
//   Per-day: orders and revenue, how much of it was delivered, and how many are
//   running late. Newest day first, the way the screen reads.
const summaryHandler = async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 1), 180);
    const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : new Date();
    const from = req.query.from
      ? new Date(`${req.query.from}T00:00:00.000Z`)
      : new Date(to.getTime() - (days - 1) * DAY_MS);

    const orders = await Order.findAll({
      where: {
        createdAt: { [Op.between]: [from, to] },
        orderStatus: { [Op.ne]: 'awaiting_payment' },   // never placed, never money
      },
      include: [{ model: OrderStatusHistory, as: 'statusHistory', required: false }],
      order: [['createdAt', 'DESC']],
    });

    const byDay = new Map();
    const totals = { orders: 0, revenue: 0, delivered: 0, deliveredRevenue: 0, late: 0, cancelled: 0 };

    for (const o of orders) {
      const key = istDate(o.createdAt);
      if (!byDay.has(key)) {
        byDay.set(key, { date: key, orders: 0, revenue: 0, delivered: 0, deliveredRevenue: 0, late: 0, cancelled: 0 });
      }
      const row = byDay.get(key);
      const value = money(o.total);
      const dead = DEAD.includes(o.orderStatus);

      row.orders += 1;
      totals.orders += 1;
      // Cancelled and returned orders are counted, but their money is not
      // revenue — it went back, or never came.
      if (!dead) { row.revenue += value; totals.revenue += value; }
      else { row.cancelled += 1; totals.cancelled += 1; }

      if (o.orderStatus === 'delivered') {
        row.delivered += 1; row.deliveredRevenue += value;
        totals.delivered += 1; totals.deliveredRevenue += value;
      }
      if (lateness(o).late) { row.late += 1; totals.late += 1; }
    }

    const rows = Array.from(byDay.values())
      .map((r) => ({ ...r, revenue: money(r.revenue), deliveredRevenue: money(r.deliveredRevenue) }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    res.json({
      success: true,
      from: istDate(from),
      to: istDate(to),
      sla: { india: SLA_DAYS.india, international: SLA_DAYS.default },
      totals: { ...totals, revenue: money(totals.revenue), deliveredRevenue: money(totals.deliveredRevenue) },
      days: rows,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { summaryHandler, lateness, dueBy, slaDays, SLA_DAYS };
