const express = require('express');
const cors = require('cors');
require('dotenv').config();

const sequelize = require('./config/db');
require('./models'); // register all models and associations

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/dbsetup',   require('./routes/dbsetup'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Avakaaya Foods API running' });
});

const PORT = process.env.PORT || 5000;

sequelize
  .sync()
  .then(() => {
    console.log('✅ MySQL connected and tables synced');
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MySQL connection error:', err);
    process.exit(1);
  });
