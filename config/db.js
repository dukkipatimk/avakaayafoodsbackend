const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.MYSQL_DB || 'avakaayafoods',
  process.env.MYSQL_USER || 'root',
  process.env.MYSQL_PASS || '',
  {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    dialect: 'mysql',
    // Raw SQL is never echoed. Every statement was being teed into logs/app.log
    // — thousands of "Executing (default): SELECT …" lines that bury the events
    // worth reading and write customer data to disk.
    //
    // It rides on its own flag rather than LOG_LEVEL, because turning the app's
    // logs up to debug to chase a bug should not also dump every query. Set
    // SQL_DEBUG=1 for the one session where you actually want it.
    logging: process.env.SQL_DEBUG === '1' ? console.log : false,
    benchmark: false,
  }
);

module.exports = sequelize;
