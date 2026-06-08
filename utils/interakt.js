/**
 * Interakt event tracking — pushes order + cart events to Interakt so you can
 * build campaigns (order updates, abandoned-cart recovery) in their dashboard.
 *
 * Uses the same INTERAKT_API_KEY as the WhatsApp template sender. Gracefully
 * degrades: if no key is set it just logs. All calls are fire-and-forget and
 * never throw into the caller.
 *
 * Docs: https://www.interakt.shop/resource-center/track-events-api/
 *   POST /v1/public/track/users/   — create/update a user
 *   POST /v1/public/track/events/  — log an event for that user
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

function interaktRequest(path, body) {
  const apiKey = process.env.INTERAKT_API_KEY;
  if (!apiKey) {
    console.log(`[INTERAKT] INTERAKT_API_KEY not set — would POST ${path}: ${JSON.stringify(body).slice(0, 200)}`);
    return Promise.resolve(null);
  }
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.interakt.ai',
        path,
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
          try { parsed = JSON.parse(data); } catch { /* non-JSON */ }
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

/**
 * Upsert the Interakt user, then log an event for them.
 * @param {Object} opts
 * @param {string}  opts.phone   raw customer phone
 * @param {string} [opts.country]
 * @param {string} [opts.name]
 * @param {string} [opts.email]
 * @param {string}  opts.event   event name (matches your Interakt campaign trigger)
 * @param {Object} [opts.traits] event properties
 */
async function trackInteraktEvent({ phone, country, name, email, event, traits = {} }) {
  const { countryCode, phoneNumber } = parsePhone(phone, country);
  if (!phoneNumber || phoneNumber.length < 7) {
    console.log(`[INTERAKT] skipped event "${event}" — invalid phone "${phone}"`);
    return;
  }

  // 1. Create / update the user so the event has someone to attach to.
  await interaktRequest('/v1/public/track/users/', {
    phoneNumber,
    countryCode,
    traits: {
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
    },
  }).catch((err) => console.error('[INTERAKT] user upsert failed:', err.message));

  // 2. Log the event.
  await interaktRequest('/v1/public/track/events/', {
    phoneNumber,
    countryCode,
    event,
    traits,
  }).catch((err) => console.error(`[INTERAKT] event "${event}" failed:`, err.message));
}

module.exports = { trackInteraktEvent };
