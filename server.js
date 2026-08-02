require('dotenv').config();
require('./utils/fileLogger'); // tee console output to logs/app.log (Passenger hides stdout)

const express = require('express');
const cors = require('cors');
const path = require('path');

const sequelize = require('./config/db');
require('./models'); // register all models and associations
const { runMigrations } = require('./utils/migrations');
const logger = require('./utils/logger');

const app = express();

// Behind a reverse proxy (Render / Heroku / Cloudflare / Hostinger), honor
// X-Forwarded-Proto so req.protocol returns 'https'. Without this, uploaded
// image URLs come back as http://… and get blocked as mixed content by an
// HTTPS storefront.
app.set('trust proxy', 1);

const allowedOrigins = [
  'https://mediumspringgreen-sparrow-932682.hostingersite.com',
  'https://avakaayafoods.com',
  'https://www.avakaayafoods.com',
  'http://localhost:3000',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    // Don't throw for other origins — throwing 500s the request in middleware,
    // which blocked Razorpay's redirect POST to /api/payment/callback. Returning
    // false just omits the CORS header while letting the request reach the route.
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-DBSetup-Secret', 'X-Requested-With'],
}));
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded product images from a PERSISTENT directory. On hosts that
// replace the app folder on each deploy (e.g. Hostinger), a path inside the app
// is wiped every deployment, so previously uploaded images vanish. Point
// UPLOADS_DIR at a directory OUTSIDE the deploy folder to keep them across
// deploys. Must match uploadsDir in routes/products.js.
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
// Uploaded image filenames are unique per upload (Date.now()-random.ext), so a
// URL's content never changes → cache aggressively (1 year, immutable). Browsers
// and any CDN in front then serve repeat images from cache instantly.
app.use('/uploads', express.static(UPLOADS_DIR, {
  maxAge: '365d',
  immutable: true,
  etag: true,
  lastModified: true,
}));

// Routes
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/products',  require('./routes/products'));
app.use('/api/cart',      require('./routes/cart'));
app.use('/api/orders',    require('./routes/orders'));
app.use('/api/payment',   require('./routes/payment'));
app.use('/api/admin',     require('./routes/admin'));
app.use('/api/shipping',  require('./routes/shipping'));
app.use('/api/instagram', require('./routes/instagram'));
app.use('/api/coupons',   require('./routes/coupons'));
app.use('/api/stores',    require('./routes/stores'));
app.use('/api/tracking',  require('./routes/tracking'));
app.use('/api/settings',  require('./routes/settings'));
app.use('/api/reports',   require('./routes/reports'));
app.use('/api/dbsetup',   require('./routes/dbsetup'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Avakaaya Foods API running' });
});

// Global error handler — last middleware. Without this, anything thrown in a
// route/middleware that isn't caught locally returns a bare, unlogged 500, so
// failures become invisible in the logs. This always logs the full error with
// the request method/path and returns a JSON body carrying the real message.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[UNHANDLED_ERROR]', {
    method: req.method,
    path: req.originalUrl,
    message: err.message,
    name: err.name,
    sql: err.sql,
    stack: err.stack,
  });
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 5000;

sequelize
  .sync()
  .then(async () => {
    logger.info('✅ MySQL connected and tables synced');
    await runMigrations(sequelize);
    const { processAbandonedLeads } = require('./utils/leadAlerts');
    processAbandonedLeads().catch((err) => logger.error('Initial abandoned lead scan failed:', err.message));
    setInterval(() => {
      processAbandonedLeads().catch((err) => logger.error('Abandoned lead scan failed:', err.message));
    }, 5 * 60 * 1000);
    app.listen(PORT, () => logger.info(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    logger.error('MySQL connection error:', err);
    process.exit(1);
  });
