const { Op } = require('sequelize');
const { LeadSession, Order, User } = require('../models');
const { sendEmail } = require('./email');
const { sendWhatsAppTemplate } = require('./whatsapp');

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const money = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;

function abandonedLeadEmail(lead) {
  const items = Array.isArray(lead.cartItems) ? lead.cartItems : [];
  const itemRows = items.map((item) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">
        ${escapeHtml(item.name || 'Product')} (${escapeHtml(item.weight)})
        ${item.bundleType === 'hamper' ? '<br/><small>Custom Gift Hamper</small>' : ''}
      </td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${Number(item.quantity) || 1}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${money(item.price)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${money((Number(item.price) || 0) * (Number(item.quantity) || 1))}</td>
    </tr>
  `).join('');
  const hamperNotes = items
    .filter((item) => item.bundleType === 'hamper' && item.customization)
    .reduce((rows, item) => {
      if (!item.bundleId || rows.some((row) => row.bundleId === item.bundleId)) return rows;
      return [...rows, { bundleId: item.bundleId, ...item.customization }];
    }, [])
    .map((notes) => `
      <p style="background:#faf6ed;padding:10px;border-radius:6px;font-size:13px;">
        <strong>Hamper instructions:</strong> ${escapeHtml(notes.styleInstructions || 'None')}<br/>
        <strong>Message card:</strong> ${escapeHtml(notes.personalMessage || 'None')}
      </p>
    `).join('');

  return `
    <div style="font-family:Arial,sans-serif;max-width:620px;color:#263326;">
      <h2 style="color:#1a2e1a;">Possible abandoned order</h2>
      <p>A shopper reached <strong>${escapeHtml(lead.stage)}</strong> and has not completed an order.</p>
      <div style="background:#f6f1e8;padding:16px;border-radius:8px;margin:16px 0;">
        <strong>${escapeHtml(lead.name || 'Unknown visitor')}</strong><br/>
        ${escapeHtml(lead.email || 'No email')}<br/>
        ${escapeHtml(lead.phone || 'No phone')}<br/>
        Location: ${escapeHtml([lead.city, lead.region, lead.country].filter(Boolean).join(', ') || 'Unknown')}<br/>
        IP address: ${escapeHtml(lead.ipAddress || 'Unavailable')}<br/>
        Cart value: <strong>${money(lead.cartValue)}</strong><br/>
        Lead score: <strong>${Number(lead.score) || 0}</strong>
      </div>
      ${items.length ? `<table style="width:100%;border-collapse:collapse;">
        <tr><th style="padding:8px;text-align:left;">Product</th><th>Qty</th><th style="text-align:right;">Price</th><th style="text-align:right;">Total</th></tr>
        ${itemRows}
      </table>${hamperNotes}` : ''}
      <p style="font-size:13px;color:#667;">Last activity: ${escapeHtml(new Date(lead.lastEventAt).toLocaleString('en-IN'))}</p>
    </div>
  `;
}

async function processAbandonedLeads() {
  const minutes = Math.max(5, Number(process.env.ABANDONED_LEAD_MINUTES) || 30);
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  const staffUsers = await User.findAll({
    where: { role: { [Op.in]: ['admin', 'store_manager'] } },
    attributes: ['id'],
  });
  const staffIds = staffUsers.map((user) => user.id);
  const staffExclusion = staffIds.length
    ? [{ [Op.or]: [{ userId: null }, { userId: { [Op.notIn]: staffIds } }] }]
    : [];
  const leads = await LeadSession.findAll({
    where: {
      [Op.and]: [
        {
          status: { [Op.in]: ['active', 'hot'] },
          stage: { [Op.in]: ['checkout', 'order'] },
          lastEventAt: { [Op.lte]: cutoff },
          alertSentAt: null,
          [Op.or]: [{ email: { [Op.ne]: null } }, { phone: { [Op.ne]: null } }],
        },
        ...staffExclusion,
      ],
    },
    limit: 20,
  });

  for (const lead of leads) {
    if (lead.orderId) {
      const order = await Order.findByPk(lead.orderId, { attributes: ['paymentStatus', 'orderStatus'] });
      if (order && (order.paymentStatus === 'paid' || order.orderStatus === 'placed')) {
        await lead.update({ status: 'converted' });
        continue;
      }
    }

    await lead.update({ status: 'abandoned', alertSentAt: new Date() });
    const to = process.env.LEAD_ALERT_EMAIL || process.env.ORDERS_EMAIL || process.env.ADMIN_EMAIL;
    if (to) {
      sendEmail({
        to,
        subject: `[POSSIBLE LEAD] Abandoned ${lead.stage} - ${lead.name || lead.email || lead.phone}`,
        html: abandonedLeadEmail(lead),
      }).catch((err) => console.error('Lead alert email failed:', err.message));
    } else {
      console.log(`[LEAD ALERT] ${lead.name || lead.email || lead.phone} abandoned ${lead.stage}; value ${money(lead.cartValue)}`);
    }

    if (process.env.ADMIN_PHONE && process.env.INTERAKT_TEMPLATE_ABANDONED_LEAD) {
      sendWhatsAppTemplate({
        phone: process.env.ADMIN_PHONE,
        country: 'India',
        template: process.env.INTERAKT_TEMPLATE_ABANDONED_LEAD,
        bodyValues: [
          lead.name || lead.email || lead.phone || 'Visitor',
          money(lead.cartValue),
          lead.phone || 'No phone',
          lead.email || 'No email',
        ],
      }).catch((err) => console.error('Lead alert WhatsApp failed:', err.message));
    }
  }

  return leads.length;
}

module.exports = { processAbandonedLeads };
