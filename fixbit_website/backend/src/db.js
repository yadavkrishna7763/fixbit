const mysql = require('mysql2');

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function shouldEnableSsl(hostname) {
  const explicitSsl = process.env.DB_SSL;
  if (explicitSsl !== undefined && explicitSsl !== '') {
    return parseBoolean(explicitSsl, false);
  }

  return /tidbcloud\.com$/i.test(String(hostname || ''));
}

function buildSslConfig(hostname) {
  if (!shouldEnableSsl(hostname)) {
    return undefined;
  }

  const rejectUnauthorized = parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, true);
  const ssl = {
    minVersion: 'TLSv1.2',
    rejectUnauthorized
  };

  if (process.env.DB_SSL_CA) {
    ssl.ca = process.env.DB_SSL_CA.replace(/\\n/g, '\n');
  }

  return ssl;
}

function buildPoolConfig() {
  const connectionString = process.env.DB_URL || process.env.DATABASE_URL;

  if (connectionString) {
    const parsed = new URL(connectionString);
    const host = parsed.hostname;

    return {
      uri: connectionString,
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
      queueLimit: 0,
      ssl: buildSslConfig(host)
    };
  }

  const host = process.env.DB_HOST || 'localhost';

  return {
    host,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || process.env.DB_DATABASE || 'fixbit',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0,
    ssl: buildSslConfig(host)
  };
}

const db = mysql.createPool(buildPoolConfig()).promise();

module.exports = db;
