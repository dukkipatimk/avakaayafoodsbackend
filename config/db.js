const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.MYSQL_DB || 'avakaayafoods',
  process.env.MYSQL_USER || 'root',
  process.env.MYSQL_PASS || '',
  {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    dialect: 'mysql',
    // Emit raw SQL only when LOG_LEVEL=debug; otherwise stay quiet.
    logging: (process.env.LOG_LEVEL || 'info').toLowerCase() === 'debug' ? console.log : false,
  }
);

module.exports = sequelize;
