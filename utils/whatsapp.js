/**
 * WhatsApp order notifications via Interakt (WhatsApp Business API).
 * Gracefully degrades — only sends if INTERAKT_API_KEY is set, otherwise logs.
 *
 * WhatsApp business-initiated messages must use pre-approved templates, so each
 * notification maps to an Interakt template name + an ordered list of body values.
 */

const https = require('https');

const COUNTRY_DIAL = {
  India: '91', 'United States': '1', 'United Kingdom': '44',
  Singapore: '65', Australia: '61', Malaysia: '60',
};

// Split a raw phone string into { countryCode: '+91', phoneNumber: '9115595959' }.
function parsePhone(raw, country) {
  let digits = String(raw || '').replace(/\D/g, '').replace(/^0+/, '');
  const cc = COUNTRY_DIAL[country] || '91';
  if (digits.startsWith(cc) && digits.length > 10) {
    digits = digits.slice(cc.length);
  } else {
    for (const code of Object.values(COUNTRY_DIAL)) {
      if (digits.length > 10 && digits.startsWith(code)) { digits = digits.slice(code.length); break; }
    }
  }
  return { countryCode: `+${cc}`, phoneNumber: digits };
}

/**
 * Send a WhatsApp template message via Interakt.
 * @param {Object} opts
 * @param {string}   opts.phone        raw phone string
 * @param {string}   [opts.country]    destination country (selects dial code)
 * @param {string}   opts.template     approved Interakt template name
 * @param {string}   [opts.languageCode]
 * @param {string[]} opts.bodyValues   ordered template body variable values
 */
async function sendWhatsAppTemplate({ phone, country, template, languageCode = 'en', bodyValues = [] }) {
  const apiKey = process.env.INTERAKT_API_KEY;
  const { countryCode, phoneNumber } = parsePhone(phone, country);

  if (!apiKey) {
    console.log('[WHATSAPP] INTERAKT_API_KEY not set — would have sent:');
    console.log(`  To: ${countryCode}${phoneNumber}  Template: ${template}`);
    console.log(`  Values: ${JSON.stringify(bodyValues)}`);
    return;
  }
  if (!phoneNumber || phoneNumber.length < 7) {
    console.log(`[WHATSAPP] skipped — invalid phone "${phone}"`);
    return;
  }

  const payload = JSON.stringify({
    countryCode,
    phoneNumber,
    type: 'Template',
    template: {
      name: template,
      languageCode,
      bodyValues: bodyValues.map((v) => String(v ?? '').trim() || '-'),
    },
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.interakt.ai',
        path: '/v1/public/message/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          Authorization: `Basic ${apiKey}`,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let parsed = {};
          try { parsed = JSON.parse(data); } catch { /* non-JSON response */ }
          if (res.statusCode >= 200 && res.statusCode < 300 && parsed.result !== false) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.message || `Interakt error ${res.statusCode}: ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.setTimeout(10000, () => req.destroy(new Error('Interakt request timeout')));
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Single-line, comma-separated item summary safe for a WhatsApp template variable.
function itemsSummary(order) {
  const lines = (order.items || []).map(
    (i) => `${i.name} (${i.variantWeight || i.variant?.weight || ''}) x${i.quantity}`
  );
  return lines.join(', ') || 'your items';
}

/**
 * Customer "order confirmed" template payload.
 * Template body variables: {{1}} name, {{2}} order no, {{3}} items, {{4}} total
 */
function orderConfirmedTemplate(order) {
  const addr = order.shippingAddress || {};
  return {
    template: process.env.INTERAKT_TEMPLATE_ORDER_CONFIRMED || 'order_confirmed',
    bodyValues: [
      addr.fullName || 'there',
      `#${order.orderNumber || order.id}`,
      itemsSummary(order),
      `${order.currency && order.currency !== 'INR' ? order.currency + ' ' : '₹'}${order.total}`,
    ],
  };
}

/**
 * Admin "new order" template payload.
 * Body variables: {{1}} order no, {{2}} customer, {{3}} phone, {{4}} items, {{5}} total, {{6}} deliver-to
 */
function newOrderTemplate(order) {
  const addr = order.shippingAddress || {};
  const deliverTo = [addr.city, addr.state, addr.pincode].filter(Boolean).join(', ') || 'See order details';
  return {
    template: process.env.INTERAKT_TEMPLATE_NEW_ORDER || 'new_order_admin',
    bodyValues: [
      `#${order.orderNumber || order.id}`,
      addr.fullName || order.guestEmail || 'Guest',
      addr.phone || 'N/A',
      itemsSummary(order),
      `${order.currency && order.currency !== 'INR' ? order.currency + ' ' : '₹'}${order.total}`,
      deliverTo,
    ],
  };
}

/**
 * Customer "order shipped" template payload.
 * Body variables: {{1}} name, {{2}} order no, {{3}} tracking
 */
function orderShippedTemplate(order) {
  const addr = order.shippingAddress || {};
  const tracking = order.trackingNumber
    ? `${order.trackingNumber}${order.trackingUrl ? ' — ' + order.trackingUrl : ''}`
    : 'Tracking details will be shared shortly';
  return {
    template: process.env.INTERAKT_TEMPLATE_ORDER_SHIPPED || 'order_shipped',
    bodyValues: [
      addr.fullName || 'there',
      `#${order.orderNumber || order.id}`,
      tracking,
    ],
  };
}

module.exports = {
  sendWhatsAppTemplate,
  orderConfirmedTemplate,
  newOrderTemplate,
  orderShippedTemplate,
};
