const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const sequelize = require('./config/db');
require('./models'); // register all models and associations
const { runMigrations } = require('./utils/migrations');

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
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-DBSetup-Secret', 'X-Requested-With'],
}));
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded product images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
app.use('/api/dbsetup',   require('./routes/dbsetup'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Avakaaya Foods API running' });
});

const PORT = process.env.PORT || 5000;

sequelize
  .sync()
  .then(async () => {
    console.log('✅ MySQL connected and tables synced');
    await runMigrations(sequelize);
    const { processAbandonedLeads } = require('./utils/leadAlerts');
    processAbandonedLeads().catch((err) => console.error('Initial abandoned lead scan failed:', err.message));
    setInterval(() => {
      processAbandonedLeads().catch((err) => console.error('Abandoned lead scan failed:', err.message));
    }, 5 * 60 * 1000);
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MySQL connection error:', err);
    process.exit(1);
  });
