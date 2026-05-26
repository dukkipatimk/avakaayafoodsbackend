const express = require('express');
const { Op, fn, col } = require('sequelize');
const router = express.Router();
const { AnalyticsEvent, LeadSession, User, Order } = require('../models');
const { optionalAuth, protect, adminOnly } = require('../middleware/auth');
const { processAbandonedLeads } = require('../utils/leadAlerts');

const EVENT_SCORE = {
  product_view: 3,
  add_to_cart: 12,
  view_cart: 6,
  begin_checkout: 20,
  address_submitted: 30,
  contact_whatsapp: 25,
  contact_phone: 25,
  order_created: 20,
  generic_click: 0,
  page_view: 0,
  order_completed: 0,
};
const KNOWN_EVENTS = new Set(Object.keys(EVENT_SCORE));

const clean = (value, max = 255) => typeof value === 'string' ? value.trim().slice(0, max) : null;

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

// @POST /api/tracking/event - anonymous or signed-in storefront activity.
router.post('/event', optionalAuth, async (req, res) => {
  try {
    const sessionId = clean(req.body.sessionId, 80);
    const eventType = clean(req.body.eventType, 40);
    if (!sessionId || !/^[\w-]{8,80}$/.test(sessionId) || !KNOWN_EVENTS.has(eventType)) {
      return res.status(400).json({ success: false, message: 'Invalid tracking event' });
    }

    const path = clean(req.body.path, 255);
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
    } else if (lead.status !== 'converted' && lead.status !== 'dismissed') {
      updates.status = stage === 'checkout' || stage === 'order' || score >= 25 ? 'hot' : 'active';
      if (lead.status === 'abandoned') updates.alertSentAt = null;
    }
    await lead.update(updates);
    processAbandonedLeads().catch((err) => console.error('Abandoned lead scan failed:', err.message));
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.use(protect, adminOnly);

// @GET /api/tracking/leads - sales follow-up queue for admins.
router.get('/leads', async (req, res) => {
  try {
    await processAbandonedLeads();
    const { status, region, limit = 100 } = req.query;
    const where = status === 'actionable'
      ? { status: { [Op.in]: ['hot', 'abandoned'] } }
      : status && status !== 'all' ? { status } : {};
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
    const [summaries, statusRows, regionalPageViews, leadRegions] = await Promise.all([
      AnalyticsEvent.findAll({
        attributes: ['eventType', [fn('COUNT', col('id')), 'count']],
        group: ['eventType'],
      }),
      LeadSession.findAll({
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        group: ['status'],
      }),
      AnalyticsEvent.findAll({
        where: { eventType: 'page_view' },
        attributes: ['region', 'country', [fn('COUNT', col('id')), 'count']],
        group: ['region', 'country'],
        order: [[fn('COUNT', col('id')), 'DESC']],
      }),
      LeadSession.findAll({
        where: { region: { [Op.ne]: null } },
        attributes: ['region', 'country', [fn('COUNT', col('id')), 'count']],
        group: ['region', 'country'],
        order: [[fn('COUNT', col('id')), 'DESC']],
      }),
    ]);
    res.json({ success: true, leads, eventSummary: summaries, statusSummary: statusRows, regionalPageViews, leadRegions });
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
