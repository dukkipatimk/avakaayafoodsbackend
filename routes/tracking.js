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
    const cartItems = Array.isArray(req.body.cartItems) ? req.body.cartItems.slice(0, 30).map((item) => ({
      productId: item.productId,
      name: clean(item.name, 100),
      weight: clean(item.weight, 20),
      quantity: Math.max(1, Number(item.quantity) || 1),
      price: Number(item.price) || 0,
    })) : undefined;
    const orderId = Number(req.body.orderId) || null;

    await AnalyticsEvent.create({
      sessionId,
      userId: req.user?.id || null,
      eventType,
      path,
      productId: Number(req.body.productId) || null,
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
    const { status, limit = 100 } = req.query;
    const where = status === 'actionable'
      ? { status: { [Op.in]: ['hot', 'abandoned'] } }
      : status && status !== 'all' ? { status } : {};
    const leads = await LeadSession.findAll({
      where,
      order: [['score', 'DESC'], ['lastEventAt', 'DESC']],
      limit: Math.min(200, Number(limit) || 100),
      include: [
        { model: User, as: 'user', attributes: ['name', 'email'], required: false },
        { model: Order, as: 'order', attributes: ['orderNumber', 'paymentStatus', 'orderStatus'], required: false },
      ],
    });
    const [summaries, statusRows] = await Promise.all([
      AnalyticsEvent.findAll({
        attributes: ['eventType', [fn('COUNT', col('id')), 'count']],
        group: ['eventType'],
      }),
      LeadSession.findAll({
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        group: ['status'],
      }),
    ]);
    res.json({ success: true, leads, eventSummary: summaries, statusSummary: statusRows });
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
