const express = require('express');
const router = express.Router();
const https = require('https');
const { Setting } = require('../models');
const { protect, superAdminOnly } = require('../middleware/auth');

const GRAPH_BASE = 'graph.instagram.com';
const TOKEN_KEY = 'instagramToken';
const PLACEHOLDER = 'your_instagram_access_token';

// Simple in-memory cache — 30 min TTL. Instagram's video URLs are signed and
// expire after a while, so this must stay well short of a day.
let cache = { data: null, fetchedAt: 0 };
const CACHE_TTL = 30 * 60 * 1000;

// A long-lived token lasts 60 days and can only be refreshed once it is at
// least a day old. Refreshing weekly keeps it alive without anyone having to
// remember to do it.
const REFRESH_AFTER = 7 * 24 * 60 * 60 * 1000;

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 10000 }, res => {
      let body = '';
      res.on('data', d => (body += d));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('Invalid JSON: ' + body.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

// The token saved in the database wins over the one in .env: it is the one
// that gets refreshed, and .env only seeds it the first time.
async function loadToken() {
  const row = await Setting.findOne({ where: { key: TOKEN_KEY } });
  if (row?.value?.token) return { token: row.value.token, refreshedAt: row.value.refreshedAt || 0 };
  const env = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!env || env === PLACEHOLDER) return null;
  return { token: env, refreshedAt: 0 };
}

async function saveToken(token) {
  const value = { token, refreshedAt: Date.now() };
  const [row] = await Setting.findOrCreate({ where: { key: TOKEN_KEY }, defaults: { value } });
  await row.update({ value });
}

async function refreshToken(token) {
  const url = `https://${GRAPH_BASE}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`;
  const data = await httpsGet(url);
  if (data.error) throw new Error(data.error.message);
  await saveToken(data.access_token);
  return data;
}

// Refresh in the background when due; a failed refresh must not break the feed.
function refreshIfDue(t) {
  if (Date.now() - t.refreshedAt < REFRESH_AFTER) return;
  refreshToken(t.token).catch(err => console.error('Instagram token refresh failed:', err.message));
}

// GET /api/instagram/feed — the latest videos (Reels) from the account.
router.get('/feed', async (req, res) => {
  // Serve from cache if fresh
  if (cache.data && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return res.json({ success: true, posts: cache.data, cached: true });
  }

  try {
    const t = await loadToken();
    if (!t) return res.json({ success: false, notConfigured: true, posts: [] });
    refreshIfDue(t);

    // Photos are mixed in with videos, so ask for enough posts to find a
    // handful of videos among them.
    const fields = 'id,media_type,media_url,thumbnail_url,permalink,caption,timestamp';
    const url = `https://${GRAPH_BASE}/me/media?fields=${fields}&limit=50&access_token=${encodeURIComponent(t.token)}`;
    const data = await httpsGet(url);

    if (data.error) {
      if (cache.data) return res.json({ success: true, posts: cache.data, stale: true });
      return res.status(400).json({ success: false, message: data.error.message });
    }

    const posts = (data.data || [])
      .filter(p => p.media_type === 'VIDEO' && p.media_url)
      .slice(0, 12)
      .map(p => ({
        id: p.id,
        videoUrl: p.media_url,
        poster: p.thumbnail_url || '',
        permalink: p.permalink,
        caption: p.caption ? p.caption.slice(0, 120) : '',
        timestamp: p.timestamp,
      }));

    cache = { data: posts, fetchedAt: Date.now() };
    res.json({ success: true, posts });
  } catch (err) {
    // Return stale cache rather than an error if we have it
    if (cache.data) return res.json({ success: true, posts: cache.data, stale: true });
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/instagram/token { token } — super admin: set a new long-lived token.
router.put('/token', protect, superAdminOnly, async (req, res) => {
  const token = String(req.body?.token || '').trim();
  if (!token) return res.status(400).json({ success: false, message: 'token is required' });
  try {
    const check = await httpsGet(`https://${GRAPH_BASE}/me?fields=username&access_token=${encodeURIComponent(token)}`);
    if (check.error) return res.status(400).json({ success: false, message: check.error.message });
    await saveToken(token);
    cache = { data: null, fetchedAt: 0 };
    res.json({ success: true, username: check.username });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/instagram/refresh-token — super admin: refresh now. The feed also
// does this on its own every week; the new token is never sent back.
router.post('/refresh-token', protect, superAdminOnly, async (req, res) => {
  try {
    const t = await loadToken();
    if (!t) return res.status(400).json({ success: false, message: 'Token not configured' });
    const data = await refreshToken(t.token);
    res.json({ success: true, expiresIn: data.expires_in });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
