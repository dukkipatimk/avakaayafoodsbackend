/**
 * WhatsApp utility via Twilio WhatsApp API.
 * Gracefully degrades — only sends if Twilio env vars are set.
 * Uses Node's built-in https module (no extra dependencies).
 */

const https = require('https');

/**
 * Send a WhatsApp message via Twilio.
 * @param {Object} opts
 * @param {string} opts.to   - e.g. "whatsapp:+919876543210"
 * @param {string} opts.message
 */
async function sendWhatsApp({ to, message }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    console.log('[WHATSAPP] Twilio not configured — would have sent:');
    console.log(`  To: ${to}`);
    console.log(`  Message: ${message}`);
    return;
  }

  const body = new URLSearchParams({
    From: from,
    To: to,
    Body: message
  }).toString();

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.twilio.com',
      path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.message || `Twilio error: ${res.statusCode}`));
          }
        } catch (e) {
          reject(new Error('Failed to parse Twilio response'));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Format new order notification for admin.
 * @param {Object} order
 * @returns {string}
 */
function newOrderNotification(order) {
  const addr = order.shippingAddress || {};
  const itemLines = (order.items || [])
    .map(i => `  • ${i.name} (${i.variantWeight || i.variant?.weight || ''}) x${i.quantity} — ₹${i.price}`)
    .join('\n');

  return [
    `🛒 *New Order Received!*`,
    `Order: #${order.orderNumber || order._id}`,
    `Customer: ${addr.fullName || order.guestEmail || 'Guest'}`,
    `Phone: ${addr.phone || 'N/A'}`,
    ``,
    `*Items:*`,
    itemLines,
    ``,
    `Subtotal: ₹${order.subtotal}`,
    order.discount ? `Discount: -₹${order.discount}` : null,
    `Shipping: ₹${order.shippingCost || 0}`,
    `*Total: ₹${order.total}*`,
    `Payment: ${order.paymentMethod || 'N/A'}`,
    ``,
    `Deliver to: ${addr.city || ''}, ${addr.state || ''} - ${addr.pincode || ''}`
  ].filter(line => line !== null).join('\n');
}

/**
 * Format order confirmation for customer.
 * @param {Object} order
 * @returns {string}
 */
function customerOrderConfirmation(order) {
  const addr = order.shippingAddress || {};
  const itemLines = (order.items || [])
    .map(i => `  • ${i.name} (${i.variantWeight || i.variant?.weight || ''}) x${i.quantity} — ₹${i.price}`)
    .join('\n');

  return [
    `✅ *Order Confirmed!*`,
    ``,
    `Hi ${addr.fullName || 'there'},`,
    `Thank you for your order with Avakaaya Foods 🙏`,
    ``,
    `Order: *#${order.orderNumber || order._id}*`,
    ``,
    `*Items:*`,
    itemLines,
    ``,
    `Subtotal: ₹${order.subtotal}`,
    order.discount ? `Discount: -₹${order.discount}` : null,
    `Shipping: ₹${order.shippingCost || 0}`,
    `*Total: ₹${order.total}*`,
    `Payment: ${order.paymentMethod || 'N/A'} (${order.paymentStatus || 'pending'})`,
    ``,
    `Delivering to:`,
    `${addr.fullName || ''}`,
    `${addr.line1 || ''}${addr.line2 ? ', ' + addr.line2 : ''}`,
    `${addr.city || ''}, ${addr.state || ''} - ${addr.pincode || ''}`,
    ``,
    `We'll notify you again once your order ships. 📦`
  ].filter(line => line !== null).join('\n');
}

/**
 * Format order shipped notification for customer.
 * @param {Object} order
 * @returns {string}
 */
function orderShippedNotification(order) {
  const addr = order.shippingAddress || {};

  const lines = [
    `📦 *Your Order Has Shipped!*`,
    ``,
    `Hi ${addr.fullName || 'there'},`,
    `Your Avakaaya Foods order *#${order.orderNumber || order._id}* is on its way!`
  ];

  if (order.trackingNumber) {
    lines.push(``, `Tracking Number: ${order.trackingNumber}`);
    if (order.trackingUrl) {
      lines.push(`Track here: ${order.trackingUrl}`);
    }
  }

  lines.push(
    ``,
    `Delivering to: ${addr.city || ''}, ${addr.state || ''} - ${addr.pincode || ''}`,
    ``,
    `Thank you for choosing Avakaaya Foods! 🙏`
  );

  return lines.join('\n');
}

/**
 * Format abandoned cart reminder for customer.
 * @param {Object} opts
 * @param {string} opts.name
 * @param {string} opts.phone
 * @param {Array}  opts.items
 * @returns {string}
 */
function abandonedCartNotification({ name, phone, items }) {
  const itemLines = (items || [])
    .map(i => `  • ${i.name}${i.weight ? ` (${i.weight})` : ''} x${i.quantity || 1}`)
    .join('\n');

  return [
    `🛒 *Hi ${name || 'there'}, you left something behind!*`,
    ``,
    `You have items waiting in your Avakaaya Foods cart:`,
    itemLines,
    ``,
    `Complete your order now and enjoy our authentic Andhra pickles delivered to your door!`,
    ``,
    `👉 Visit: ${process.env.FRONTEND_URL || 'https://avakaayafoods.com'}/cart`,
    ``,
    `Need help? Reply to this message anytime.`
  ].join('\n');
}

module.exports = {
  sendWhatsApp,
  newOrderNotification,
  customerOrderConfirmation,
  orderShippedNotification,
  abandonedCartNotification
};
