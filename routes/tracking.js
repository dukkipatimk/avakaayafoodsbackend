const express = require('express');
const { Op, fn, col, literal } = require('sequelize');
const router = express.Router();
const { AnalyticsEvent, LeadSession, User, Order, OrderStatusHistory } = require('../models');
const { optionalAuth, protect, staffOnly } = require('../middleware/auth');
const { processAbandonedLeads } = require('../utils/leadAlerts');
const { sendWhatsAppTemplate, checkoutStartedTemplate, checkoutCompletedTemplate, checkoutFailedTemplate } = require('../utils/whatsapp');

const EVENT_SCORE = {
  product_view: 3,
  add_to_cart: 12,
  view_cart: 6,
  begin_checkout: 20,
  address_submitted: 30,
  checkout_failed: -10,
  contact_whatsapp: 25,
  contact_phone: 25,
  order_created: 20,
  generic_click: 0,
  page_view: 0,
  order_completed: 0,
};
const KNOWN_EVENTS = new Set(Object.keys(EVENT_SCORE));
const STAFF_ROLES = new Set(['admin', 'store_manager']);

// A session only counts as a LEAD once it has at least one product in the cart.
// Pure browsers / empty carts are still tracked for analytics but are excluded
// from the leads list and lead counts.
const HAS_PRODUCTS = literal('JSON_LENGTH(cartItems) > 0');

const clean = (value, max = 255) => typeof value === 'string' ? value.trim().slice(0, max) : null;
const isStaffUser = (user) => STAFF_ROLES.has(user?.role);
const isAdminPath = (path) => /^\/admin(?:\/|$)/i.test(path || '');

const header = (req, key) => {
  const value = req.headers[key];
  return Array.isArray(value) ? value[0] : value;
};

function visitorLocation(req, contact, metadata) {
  const forwardedIp = String(header(req, 'x-forwarded-for') || '').split(',')[0].trim();
  const country = clean(
    contact.country || metadata.country || header(req, 'cf-ipcountry') ||
    header(req, 'x-vercel-ip-country') || header(req, 'cloudfront-viewer-country-name'),
    100
  );
  const detailedRegion = clean(
    contact.region || contact.state || metadata.region || metadata.state ||
    header(req, 'x-vercel-ip-country-region') || header(req, 'cloudfront-viewer-country-region-name') ||
    header(req, 'x-appengine-region'),
    120
  );
  return {
    ipAddress: clean(header(req, 'cf-connecting-ip') || header(req, 'x-real-ip') || forwardedIp || req.ip, 80),
    country,
    region: detailedRegion || country,
    city: clean(contact.city || metadata.city || header(req, 'x-vercel-ip-city') || header(req, 'cloudfront-viewer-city'), 120),
    hasDetailedRegion: Boolean(detailedRegion),
  };
}

function nextStage(current, eventType) {
  if (eventType === 'order_created' || eventType === 'order_completed') return 'order';
  if (eventType === 'begin_checkout' || eventType === 'address_submitted') return 'checkout';
  if (eventType === 'add_to_cart' || eventType === 'view_cart') {
    return current === 'checkout' || current === 'order' ? current : 'cart';
  }
  return current || 'browsing';
}

const trackedTrendEvents = ['page_view', 'generic_click'];
const trendStartDate = (unit) => {
  const date = new Date();
  if (unit === 'daily') date.setDate(date.getDate() - 29);
  if (unit === 'weekly') date.setDate(date.getDate() - 83);
  if (unit === 'monthly') {
    date.setMonth(date.getMonth() - 11);
    date.setDate(1);
  }
  date.setHours(0, 0, 0, 0);
  return date;
};

async function analyticsTrend(unit, publicEventWhere) {
  const periodSql = {
    daily: 'DATE(`AnalyticsEvent`.`createdAt`)',
    weekly: 'DATE_FORMAT(`AnalyticsEvent`.`createdAt`, "%x-W%v")',
    monthly: 'DATE_FORMAT(`AnalyticsEvent`.`createdAt`, "%Y-%m")',
  }[unit];
  const period = literal(periodSql);
  return AnalyticsEvent.findAll({
    attributes: [
      [period, 'period'],
      'eventType',
      [fn('COUNT', col('AnalyticsEvent.id')), 'count'],
    ],
    where: {
      [Op.and]: [
        ...publicEventWhere[Op.and],
        { eventType: { [Op.in]: trackedTrendEvents } },
        { createdAt: { [Op.gte]: trendStartDate(unit) } },
      ],
    },
    group: [period, 'eventType'],
    order: [[period, 'ASC']],
    raw: true,
  });
}

// @POST /api/tracking/event - anonymous or signed-in storefront activity.
router.post('/event', optionalAuth, async (req, res) => {
  try {
    const sessionId = clean(req.body.sessionId, 80);
    const eventType = clean(req.body.eventType, 40);
    if (!sessionId || !/^[\w-]{8,80}$/.test(sessionId) || !KNOWN_EVENTS.has(eventType)) {
      return res.status(400).json({ success: false, message: 'Invalid tracking event' });
    }

    const path = clean(req.body.path, 255);
    if (isStaffUser(req.user) || isAdminPath(path)) {
      return res.status(204).end();
    }

    const metadata = req.body.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {};
    const contact = req.body.contact && typeof req.body.contact === 'object' ? req.body.contact : {};
    const location = visitorLocation(req, contact, metadata);
    const cartItems = Array.isArray(req.body.cartItems) ? req.body.cartItems.slice(0, 30).map((item) => ({
      productId: item.productId,
      name: clean(item.name, 100),
      slug: clean(item.slug, 140),
      thumbnail: clean(item.thumbnail, 500),
      weight: clean(item.weight, 20),
      quantity: Math.max(1, Number(item.quantity) || 1),
      price: Number(item.price) || 0,
      mrp: Number(item.mrp) || Number(item.price) || 0,
      isVeg: typeof item.isVeg === 'boolean' ? item.isVeg : null,
      bundleId: clean(item.bundleId, 120),
      bundleType: item.bundleType === 'hamper' ? 'hamper' : null,
      bundleLabel: clean(item.bundleLabel, 80),
      customization: item.bundleType === 'hamper' ? {
        personalMessage: clean(item.customization?.personalMessage, 200),
        styleInstructions: clean(item.customization?.styleInstructions, 300),
      } : null,
    })) : undefined;
    const orderId = Number(req.body.orderId) || null;

    await AnalyticsEvent.create({
      sessionId,
      userId: req.user?.id || null,
      eventType,
      path,
      productId: Number(req.body.productId) || null,
      ipAddress: location.ipAddress,
      country: location.country,
      region: location.region,
      city: location.city,
      metadata,
    });

    let lead = await LeadSession.findOne({ where: { sessionId } });
    if (!lead) lead = await LeadSession.create({ sessionId, lastEventAt: new Date() });

    const stage = nextStage(lead.stage, eventType);
    const score = Math.min(999, Number(lead.score || 0) + EVENT_SCORE[eventType]);
    const updates = {
      userId: req.user?.id || lead.userId || null,
      name: clean(contact.name, 120) || lead.name,
      email: clean(contact.email, 180) || lead.email,
      phone: clean(contact.phone, 40) || lead.phone,
      ipAddress: location.ipAddress || lead.ipAddress,
      country: location.country || lead.country,
      region: location.hasDetailedRegion || !lead.region ? location.region : lead.region,
      city: location.city || lead.city,
      stage,
      score,
      eventCount: Number(lead.eventCount || 0) + 1,
      productViews: Number(lead.productViews || 0) + (eventType === 'product_view' ? 1 : 0),
      cartAdds: Number(lead.cartAdds || 0) + (eventType === 'add_to_cart' ? 1 : 0),
      lastPath: path || lead.lastPath,
      lastEventType: eventType,
      lastEventAt: new Date(),
      source: clean(metadata.source, 100) || lead.source,
      orderId: orderId || lead.orderId,
    };
    if (req.body.cartValue !== undefined) updates.cartValue = Math.max(0, Number(req.body.cartValue) || 0);
    if (cartItems) updates.cartItems = cartItems;

    if (eventType === 'order_completed') {
      updates.status = 'converted';
      // Notify admin of successful checkout completion
      const adminPhone = process.env.ADMIN_PHONE;
      if (adminPhone && lead.name) {
        sendWhatsAppTemplate({
          phone: adminPhone,
          country: 'India',
          ...checkoutCompletedTemplate(lead, `Order #${orderId || 'Completed'}`),
        }).catch((err) => console.error('Admin checkout completed notification failed:', err.message));
      }
    } else if (eventType === 'begin_checkout') {
      // Notify admin of checkout start
      const adminPhone = process.env.ADMIN_PHONE;
      if (adminPhone && lead.name && Number(updates.cartValue || 0) > 0) {
        sendWhatsAppTemplate({
          phone: adminPhone,
          country: 'India',
          ...checkoutStartedTemplate(updates),
        }).catch((err) => console.error('Admin checkout started notification failed:', err.message));
      }
    } else if (eventType === 'checkout_failed') {
      // Notify admin of checkout failure
      const adminPhone = process.env.ADMIN_PHONE;
      const failureReason = clean(metadata.reason || 'Unknown error', 100) || 'Payment issue';
      if (adminPhone && lead.name) {
        sendWhatsAppTemplate({
          phone: adminPhone,
          country: 'India',
          ...checkoutFailedTemplate(lead, failureReason),
        }).catch((err) => console.error('Admin checkout failed notification failed:', err.message));
      }
    }

    if (lead.status !== 'converted' && lead.status !== 'dismissed') {
      // A lead only qualifies as HOT when there is at least one product in the
      // cart. Use the cart from this event if present, else the lead's last
      // known cart. Pure browsing / contact clicks with an empty cart stay 'active'.
      const effectiveCart = cartItems !== undefined ? cartItems : lead.cartItems;
      const hasCartItems = Array.isArray(effectiveCart) && effectiveCart.length > 0;
      // A visitor who has given us both a name and a phone number is reachable,
      // so they are worth calling regardless of how far they got or scored.
      const identified = Boolean(updates.name && updates.phone);
      const engaged = identified || stage === 'checkout' || stage === 'order' || score >= 25;
      updates.status = hasCartItems && engaged ? 'hot' : 'active';
      if (lead.status === 'abandoned') updates.alertSentAt = null;
    }
    await lead.update(updates);
    processAbandonedLeads().catch((err) => console.error('Abandoned lead scan failed:', err.message));
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Leads / sales-follow-up endpoints are open to staff (admins + store managers).
router.use(protect, staffOnly);

// @GET /api/tracking/leads - sales follow-up queue for staff.
router.get('/leads', async (req, res) => {
  try {
    await processAbandonedLeads();
    const { status, region, limit = 100 } = req.query;
    const staffUsers = await User.findAll({
      where: { role: { [Op.in]: Array.from(STAFF_ROLES) } },
      attributes: ['id'],
    });
    const staffIds = staffUsers.map((user) => user.id);
    const publicLeadClauses = staffIds.length
      ? [{ [Op.or]: [{ userId: null }, { userId: { [Op.notIn]: staffIds } }] }]
      : [];
    const publicEventWhere = {
      [Op.and]: [
        { [Op.or]: [{ path: null }, { path: { [Op.notLike]: '/admin%' } }] },
        ...publicLeadClauses,
      ],
    };
    const statusWhere = status === 'actionable'
      ? { status: { [Op.in]: ['hot', 'abandoned'] } }
      // "checkout" is a stage, not a status — leads that reached checkout or order.
      : status === 'checkout'
      ? { stage: { [Op.in]: ['checkout', 'order'] } }
      : status && status !== 'all' ? { status } : {};
    const where = { [Op.and]: [statusWhere, HAS_PRODUCTS, ...publicLeadClauses] };
    if (region && region !== 'all') where.region = clean(region, 120);
    const leads = await LeadSession.findAll({
      where,
      order: [['score', 'DESC'], ['lastEventAt', 'DESC']],
      limit: Math.min(200, Number(limit) || 100),
      include: [
        { model: User, as: 'user', attributes: ['name', 'email'], required: false },
        { model: Order, as: 'order', attributes: ['orderNumber', 'paymentStatus', 'orderStatus'], required: false },
      ],
    });
    const [summaries, statusRows, regionalPageViews, leadRegions, dailyTrend, weeklyTrend, monthlyTrend] = await Promise.all([
      AnalyticsEvent.findAll({
        attributes: ['eventType', [fn('COUNT', col('id')), 'count']],
        where: publicEventWhere,
        group: ['eventType'],
      }),
      LeadSession.findAll({
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        where: { [Op.and]: [HAS_PRODUCTS, ...publicLeadClauses] },
        group: ['status'],
      }),
      AnalyticsEvent.findAll({
        where: { [Op.and]: [{ eventType: 'page_view' }, ...publicEventWhere[Op.and]] },
        attributes: ['region', 'country', [fn('COUNT', col('id')), 'count']],
        group: ['region', 'country'],
        order: [[fn('COUNT', col('id')), 'DESC']],
      }),
      LeadSession.findAll({
        where: { [Op.and]: [{ region: { [Op.ne]: null } }, HAS_PRODUCTS, ...publicLeadClauses] },
        attributes: ['region', 'country', [fn('COUNT', col('id')), 'count']],
        group: ['region', 'country'],
        order: [[fn('COUNT', col('id')), 'DESC']],
      }),
      analyticsTrend('daily', publicEventWhere),
      analyticsTrend('weekly', publicEventWhere),
      analyticsTrend('monthly', publicEventWhere),
    ]);
    res.json({
      success: true,
      leads,
      eventSummary: summaries,
      statusSummary: statusRows,
      regionalPageViews,
      leadRegions,
      analyticsTrends: {
        daily: dailyTrend,
        weekly: weeklyTrend,
        monthly: monthlyTrend,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/tracking/leads/:id/journey - the pages/events this visitor saw.
router.get('/leads/:id/journey', async (req, res) => {
  try {
    const lead = await LeadSession.findByPk(req.params.id, { attributes: ['id', 'sessionId'] });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const events = await AnalyticsEvent.findAll({
      where: { sessionId: lead.sessionId },
      attributes: ['eventType', 'path', 'productId', 'createdAt'],
      order: [['createdAt', 'ASC']],
      limit: 300,
    });
    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @POST /api/tracking/leads/:id/place-order - admin manually places a lead's
// pending order (e.g. customer confirmed via WhatsApp / will pay on delivery).
router.post('/leads/:id/place-order', async (req, res) => {
  try {
    const lead = await LeadSession.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    if (!lead.orderId) {
      return res.status(400).json({
        success: false,
        message: 'This lead has no order yet — the customer never reached checkout, so there is no address to ship to.',
      });
    }
    const order = await Order.findByPk(lead.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Linked order not found' });

    if (order.orderStatus === 'awaiting_payment') {
      await order.update({ orderStatus: 'placed' });
      await OrderStatusHistory.create({
        orderId: order.id,
        status: 'placed',
        note: 'Order placed manually by admin from lead (payment to be collected).',
      });
    }
    await lead.update({ status: 'converted', stage: 'order' });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PATCH /api/tracking/leads/:id - dismiss or restore a lead.
router.patch('/leads/:id', async (req, res) => {
  try {
    const status = clean(req.body.status, 20);
    if (!['active', 'hot', 'dismissed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid lead status' });
    }
    const lead = await LeadSession.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    await lead.update({ status });
    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
