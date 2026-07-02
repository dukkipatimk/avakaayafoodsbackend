const express = require('express');
const https = require('https');
const Product = require('../models/Product');
const router = express.Router();

// Shipping zones configuration
const SHIPPING_ZONES = {
  india: {
    label: 'India',
    currency: 'INR',
    freeAbove: 2000,
    standard: { rate: 80, days: '1-2 business days', label: 'Standard Delivery' },
    express: { rate: 150, days: '1-2 business days', label: 'Express Delivery' }
  },
  usa: {
    label: 'United States',
    currency: 'USD',
    freeAbove: null,
    standard: { rate: 25, days: '10-14 business days', label: 'International Standard' },
    express: { rate: 45, days: '5-7 business days', label: 'International Express' }
  },
  uk: {
    label: 'United Kingdom',
    currency: 'GBP',
    freeAbove: null,
    standard: { rate: 20, days: '10-14 business days', label: 'International Standard' },
    express: { rate: 35, days: '5-7 business days', label: 'International Express' }
  },
  singapore: {
    label: 'Singapore',
    currency: 'SGD',
    freeAbove: null,
    standard: { rate: 18, days: '7-10 business days', label: 'International Standard' },
    express: { rate: 30, days: '4-6 business days', label: 'International Express' }
  },
  australia: {
    label: 'Australia',
    currency: 'AUD',
    freeAbove: null,
    standard: { rate: 28, days: '10-14 business days', label: 'International Standard' },
    express: { rate: 50, days: '6-8 business days', label: 'International Express' }
  },
  malaysia: {
    label: 'Malaysia',
    currency: 'MYR',
    freeAbove: null,
    standard: { rate: 45, days: '7-10 business days', label: 'International Standard' },
    express: { rate: 80, days: '4-6 business days', label: 'International Express' }
  }
};

const COUNTRY_TO_ZONE = {
  'India': 'india',
  'United States': 'usa', 'USA': 'usa',
  'United Kingdom': 'uk', 'UK': 'uk',
  'Singapore': 'singapore',
  'Australia': 'australia',
  'Malaysia': 'malaysia'
};

// @GET /api/shipping/zones
router.get('/zones', (req, res) => {
  const zones = Object.entries(SHIPPING_ZONES).map(([key, val]) => ({
    id: key,
    label: val.label,
    currency: val.currency,
    freeAbove: val.freeAbove,
    methods: [
      { id: 'standard', ...val.standard },
      { id: 'express', ...val.express }
    ]
  }));
  res.json({ success: true, zones });
});

// @POST /api/shipping/calculate
router.post('/calculate', (req, res) => {
  try {
    const { country, method = 'standard', subtotal = 0 } = req.body;
    const zoneKey = COUNTRY_TO_ZONE[country] || 'india';
    const zone = SHIPPING_ZONES[zoneKey];

    let shippingCost = zone[method]?.rate || zone.standard.rate;

    // Free shipping for India orders above threshold
    if (zoneKey === 'india' && subtotal >= zone.freeAbove) {
      shippingCost = 0;
    }

    res.json({
      success: true,
      zone: zoneKey,
      currency: zone.currency,
      method: zone[method],
      shippingCost,
      freeShippingAbove: zone.freeAbove,
      estimatedDelivery: zone[method]?.days
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Live rate API ─────────────────────────────────────────────────────────────

function callAvakaayaAPI(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: 'accounts.avakaaya.com',
        path: '/api/v1/Services/GetRate',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      res => {
        let data = '';
        res.on('data', d => (data += d));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid JSON from shipping API')); }
        });
      }
    );
    req.setTimeout(10000, () => req.destroy(new Error('Shipping API timeout')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function calcWeightKg(items) {
  let grams = 0;
  for (const item of items || []) {
    const qty = item.quantity || 1;
    let itemGrams = 0;
    if (item.productId) {
      const p = await Product.findByPk(item.productId, { attributes: ['weight_for_shipping'] }).catch(() => null);
      if (p?.weight_for_shipping) { itemGrams = p.weight_for_shipping; }
    }
    if (!itemGrams) {
      const w = String(item.weight || '500g');
      if (w.endsWith('kg')) itemGrams = parseFloat(w) * 1000;
      else if (w.endsWith('g')) itemGrams = parseFloat(w);
      else itemGrams = 500;
    }
    grams += itemGrams * qty;
  }
  return Math.max(parseFloat((grams / 1000).toFixed(3)), 0.1);
}

const DEST_CODE_MAP = {
  'India': 'IN',
  'United States': 'US',
  'United Kingdom': 'GB',
  'Singapore': 'SG',
  'Australia': 'AU',
  'Malaysia': 'MY',
};

// @POST /api/shipping/rate  — live rates from Avakaaya logistics API
router.post('/rate', async (req, res) => {
  try {
    const { pincode, country = 'India', items } = req.body;
    if (!pincode) return res.status(400).json({ success: false, message: 'Pincode is required' });

    const destCode = DEST_CODE_MAP[country] || 'IN';
    const weightKg = await calcWeightKg(items);

    const apiRes = await callAvakaayaAPI({
      UserID: 'APH',
      Password: 'Jampani@1',
      CustomerCode: 'APH',
      VendorCode: '',
      ProductCode: '',
      DestinationCode: destCode,
      ConsigneePincode: String(pincode),
      Weight: weightKg,
    });

    if (apiRes?.Response?.StatusCode !== '0') {
      return res.status(502).json({ success: false, message: apiRes?.Response?.Message || 'Shipping API error' });
    }

    const services = (apiRes.Response.RespList || []).map(s => ({
      vendor: s.Vendor,
      service: s.Service,
      amount: s.Amount,
      tax: s.Tax,
      total: s['Grand Total'],
      displayDays: s['Display Days'] || '',
      vendorCode: s.Vendor_Code,
      productCode: s.Prod_Code,
    }));

    res.json({ success: true, services, weightKg });
  } catch (err) {
    console.error('Shipping rate error:', err.message);
    res.status(502).json({ success: false, message: 'Could not fetch live shipping rates' });
  }
});

module.exports = router;
module.exports.SHIPPING_ZONES = SHIPPING_ZONES;
module.exports.COUNTRY_TO_ZONE = COUNTRY_TO_ZONE;
