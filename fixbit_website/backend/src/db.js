const mysql = require('mysql2');

const poolConfig = process.env.DB_URL || process.env.DATABASE_URL || {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || process.env.DB_DATABASE || 'fixbit',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0
};

const db = mysql.createPool(poolConfig).promise();

module.exports = db;
