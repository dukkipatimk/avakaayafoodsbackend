/**
 * Email utility — gracefully degrades if SMTP env vars are not set.
 * Uses nodemailer if available and SMTP_HOST is configured, otherwise logs to console.
 */

let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  // nodemailer not installed — will fall back to console logging
}

/**
 * Send an email.
 * @param {Object} opts
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} opts.html
 */
async function sendEmail({ to, subject, html }) {
  if (!process.env.SMTP_HOST || !nodemailer) {
    console.log('[EMAIL] SMTP not configured — would have sent:');
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"Avakaaya Foods" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html
  });
}

/**
 * Generate order confirmation HTML email.
 * @param {Object} order - Mongoose Order document
 * @returns {string} HTML string
 */
function orderConfirmationEmail(order) {
  const itemsHtml = (order.items || []).map(item => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;">${item.name} (${item.variantWeight || item.variant?.weight || ''})</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">₹${item.price}</td>
    </tr>
  `).join('');

  const addr = order.shippingAddress || {};

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Order Confirmed</title></head>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <h1 style="color:#b45309;">Avakaaya Foods</h1>
    <h2 style="color:#16a34a;">Order Confirmed!</h2>
  </div>
  <p>Hi ${addr.fullName || 'there'},</p>
  <p>Thank you for your order. We've received it and will begin processing shortly.</p>

  <div style="background:#f9f9f9;border-radius:8px;padding:16px;margin:16px 0;">
    <strong>Order Number:</strong> #${order.orderNumber || order._id}<br/>
    <strong>Payment Method:</strong> ${order.paymentMethod || 'N/A'}
  </div>

  <h3>Items Ordered</h3>
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr style="background:#f3f4f6;">
        <th style="padding:8px;text-align:left;">Item</th>
        <th style="padding:8px;text-align:center;">Qty</th>
        <th style="padding:8px;text-align:right;">Price</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>

  <div style="margin-top:16px;text-align:right;">
    <p><strong>Subtotal:</strong> ₹${order.subtotal}</p>
    ${order.discount ? `<p><strong>Discount:</strong> -₹${order.discount}</p>` : ''}
    <p><strong>Shipping:</strong> ₹${order.shippingCost || 0}</p>
    <p style="font-size:18px;"><strong>Total: ₹${order.total}</strong></p>
  </div>

  <div style="background:#f9f9f9;border-radius:8px;padding:16px;margin-top:16px;">
    <h3 style="margin-top:0;">Shipping To</h3>
    <p>${addr.fullName || ''}<br/>
    ${addr.line1 || ''}${addr.line2 ? ', ' + addr.line2 : ''}<br/>
    ${addr.city || ''}, ${addr.state || ''} - ${addr.pincode || ''}<br/>
    ${addr.country || ''}</p>
  </div>

  <p style="margin-top:24px;color:#666;font-size:14px;">
    We'll send you another email once your order is shipped. For any queries, reply to this email or contact us.
  </p>
  <p style="color:#b45309;font-weight:bold;">Avakaaya Foods Team</p>
</body>
</html>
  `.trim();
}

/**
 * Generate order shipped HTML email.
 * @param {Object} order - Mongoose Order document
 * @returns {string} HTML string
 */
function orderShippedEmail(order) {
  const addr = order.shippingAddress || {};

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your Order Has Shipped</title></head>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <h1 style="color:#b45309;">Avakaaya Foods</h1>
    <h2 style="color:#2563eb;">Your Order Is On Its Way!</h2>
  </div>
  <p>Hi ${addr.fullName || 'there'},</p>
  <p>Great news! Your order <strong>#${order.orderNumber || order._id}</strong> has been shipped and is on its way to you.</p>

  ${order.trackingNumber ? `
  <div style="background:#eff6ff;border-radius:8px;padding:16px;margin:16px 0;">
    <strong>Tracking Number:</strong> ${order.trackingNumber}<br/>
    ${order.trackingUrl ? `<a href="${order.trackingUrl}" style="color:#2563eb;">Track Your Package</a>` : ''}
  </div>
  ` : ''}

  <div style="background:#f9f9f9;border-radius:8px;padding:16px;margin:16px 0;">
    <h3 style="margin-top:0;">Shipping To</h3>
    <p>${addr.fullName || ''}<br/>
    ${addr.line1 || ''}${addr.line2 ? ', ' + addr.line2 : ''}<br/>
    ${addr.city || ''}, ${addr.state || ''} - ${addr.pincode || ''}<br/>
    ${addr.country || ''}</p>
  </div>

  <p style="color:#666;font-size:14px;">
    If you have any questions about your delivery, please don't hesitate to contact us.
  </p>
  <p style="color:#b45309;font-weight:bold;">Avakaaya Foods Team</p>
</body>
</html>
  `.trim();
}

module.exports = { sendEmail, orderConfirmationEmail, orderShippedEmail };
