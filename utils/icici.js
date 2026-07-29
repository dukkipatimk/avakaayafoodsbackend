// ── ICICI Bank Payment Gateway ("Orange PG", pgpay.icicibank.com) ──────────────
// Standard/Redirect flow (payType=0): server calls initiateSale (JSON) → gets a
// redirectURI + tranCtx → the browser is sent to redirectURI?tranCtx=… → after
// payment ICICI browser-POSTs the result (form-urlencoded) back to our returnURL.
//
// secureHash = HMAC-SHA256 over the request/response *values* concatenated in
// ascending key order (excluding secureHash, skipping null/empty), hex lowercase,
// keyed with the merchant's shared Key. (Hash Calc "V1".)
const crypto = require('crypto');

const cfg = () => ({
  merchantId:   process.env.ICICI_MERCHANT_ID || '',
  aggregatorId: process.env.ICICI_AGGREGATOR_ID || '',
  key:          process.env.ICICI_SECRET_KEY || process.env.ICICI_WORKING_KEY || '',
  saleUrl:      process.env.ICICI_SALE_URL   || 'https://pgpayuat.icicibank.com/tsp/pg/api/v2/initiateSale',
  commandUrl:   process.env.ICICI_COMMAND_URL || 'https://pgpayuat.icicibank.com/tsp/pg/api/command',
  returnUrl:    process.env.ICICI_RETURN_URL || '',
});

const configured = () => { const c = cfg(); return !!(c.merchantId && c.key); };

// Concatenate non-empty values in ascending key order (excluding secureHash).
function hashInput(params) {
  return Object.keys(params).sort()
    .filter((k) => k !== 'secureHash' && params[k] != null && String(params[k]) !== '')
    .map((k) => String(params[k]))
    .join('');
}
function signV1(params, key) {
  return crypto.createHmac('sha256', key).update(hashInput(params), 'utf8').digest('hex');
}
// Verify a response's secureHash against a freshly computed one (case-insensitive).
function verifyHash(params, key = cfg().key) {
  const got = String(params.secureHash || '').toLowerCase();
  if (!got) return false;
  return got === signV1(params, key).toLowerCase();
}

const pad = (n) => String(n).padStart(2, '0');
// txnDate must be >= payment-initiation time; use today at 23:59:59 to stay valid.
function txnDateEndOfDay(d = new Date()) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}235959`;
}
// merchantTxnNo: unique per attempt, alphanumeric only, <=20 chars. Encodes the
// order id so the response can be mapped even without the stored ref.
function merchantTxnNo(orderId) {
  const raw = `AKF${orderId}${Date.now().toString(36)}`.replace(/[^a-zA-Z0-9]/g, '');
  return raw.slice(0, 20);
}
const trim = (v, n) => String(v == null ? '' : v).replace(/[\r\n]/g, ' ').slice(0, n);

// Build the initiateSale request (+ secureHash) for an order.
function buildSaleRequest({ orderId, amount, email, phone, name }) {
  const c = cfg();
  const params = {
    merchantId:      c.merchantId,
    merchantTxnNo:   merchantTxnNo(orderId),
    amount:          Number(amount).toFixed(2),
    currencyCode:    '356',
    payType:         '0',                 // Standard / redirection (card page on ICICI)
    transactionType: 'SALE',
    txnDate:         txnDateEndOfDay(),
    customerEmailID: trim(email || 'guest@avakaayafoods.com', 48),
    returnURL:       c.returnUrl,
    addlParam1:      String(orderId),     // echoed back → order mapping fallback
  };
  if (c.aggregatorId) params.aggregatorID = c.aggregatorId;
  if (phone) params.customerMobileNo = trim(String(phone).replace(/[^0-9]/g, ''), 13);
  if (name)  params.customerName = trim(name, 45);
  params.secureHash = signV1(params, c.key);
  return params;
}

async function postJson(url, bodyObj) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyObj) });
  const raw = await res.text();
  let json = null; try { json = JSON.parse(raw); } catch (e) { /* non-json */ }
  return { status: res.status, ok: res.ok, json, raw };
}
async function postForm(url, params) {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const raw = await res.text();
  let json = null; try { json = JSON.parse(raw); } catch (e) { /* non-json */ }
  return { status: res.status, ok: res.ok, json, raw };
}

// Call initiateSale. Returns { responseCode, redirectURI, tranCtx, ... } on success.
async function initiateSale(params) {
  return postJson(cfg().saleUrl, params);
}

// Server-to-server transaction status (for reconciliation / fallback).
async function txnStatus({ merchantTxnNo: mtxn, originalTxnNo }) {
  const c = cfg();
  const params = { merchantId: c.merchantId, merchantTxnNo: mtxn, originalTxnNo, transactionType: 'STATUS' };
  if (c.aggregatorId) params.aggregatorID = c.aggregatorId;
  params.secureHash = signV1(params, c.key);
  return postForm(c.commandUrl, params);
}

// A payment/response is successful when responseCode is 000 or 0000.
const isSuccessCode = (code) => code === '000' || code === '0000';

module.exports = { cfg, configured, signV1, verifyHash, buildSaleRequest, initiateSale, txnStatus, isSuccessCode, merchantTxnNo };
