const express = require('express');
const router = express.Router();
const https = require('https');

const GRAPH_BASE = 'graph.instagram.com';

// Simple in-memory cache — 30 min TTL
let cache = { data: null, fetchedAt: 0 };
const CACHE_TTL = 30 * 60 * 1000;

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

// GET /api/instagram/feed  — returns up to 12 recent posts
router.get('/feed', async (req, res) => {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!token || token === 'your_instagram_access_token') {
    return res.json({ success: false, notConfigured: true, posts: [] });
  }

  // Serve from cache if fresh
  if (cache.data && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return res.json({ success: true, posts: cache.data, cached: true });
  }

  try {
    const fields = 'id,media_type,media_url,thumbnail_url,permalink,caption,timestamp';
    const url = `https://${GRAPH_BASE}/me/media?fields=${fields}&limit=12&access_token=${token}`;
    const data = await httpsGet(url);

    if (data.error) {
      return res.status(400).json({ success: false, message: data.error.message });
    }

    const posts = (data.data || []).map(p => ({
      id: p.id,
      type: p.media_type,               // IMAGE | VIDEO | CAROUSEL_ALBUM
      url: p.media_type === 'VIDEO' ? p.thumbnail_url : p.media_url,
      permalink: p.permalink,
      caption: p.caption ? p.caption.slice(0, 120) : '',
      timestamp: p.timestamp,
      isVideo: p.media_type === 'VIDEO',
    }));

    cache = { data: posts, fetchedAt: Date.now() };
    res.json({ success: true, posts });
  } catch (err) {
    // Return stale cache rather than an error if we have it
    if (cache.data) return res.json({ success: true, posts: cache.data, stale: true });
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/instagram/refresh-token  — call this periodically (every ~50 days)
router.post('/refresh-token', async (req, res) => {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token || token === 'your_instagram_access_token') {
    return res.status(400).json({ success: false, message: 'Token not configured' });
  }
  try {
    const url = `https://${GRAPH_BASE}/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`;
    const data = await httpsGet(url);
    if (data.error) return res.status(400).json({ success: false, message: data.error.message });
    res.json({ success: true, newToken: data.access_token, expiresIn: data.expires_in });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
