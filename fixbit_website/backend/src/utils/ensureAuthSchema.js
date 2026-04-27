const db = require('../db');
const { normalizeEmailAddress, normalizePhoneNumber } = require('./contact');

async function columnExists(tableName, columnName) {
  const [rows] = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return Boolean(rows[0]);
}

async function indexExists(tableName, indexName) {
  const [rows] = await db.query(
    `SELECT 1
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND index_name = ?
     LIMIT 1`,
    [tableName, indexName]
  );
  return Boolean(rows[0]);
}

async function ensureUsersColumns() {
  if (!(await columnExists('users', 'normalized_phone'))) {
    await db.query('ALTER TABLE users ADD COLUMN normalized_phone VARCHAR(32) DEFAULT NULL AFTER phone');
  }

  if (!(await columnExists('users', 'email_verified_at'))) {
    await db.query('ALTER TABLE users ADD COLUMN email_verified_at DATETIME DEFAULT NULL AFTER normalized_phone');
  }

  if (!(await columnExists('users', 'phone_verified_at'))) {
    await db.query('ALTER TABLE users ADD COLUMN phone_verified_at DATETIME DEFAULT NULL AFTER email_verified_at');
  }

  if (!(await indexExists('users', 'uniq_normalized_phone'))) {
    await db.query('ALTER TABLE users ADD UNIQUE KEY uniq_normalized_phone (normalized_phone)');
  }
}

async function normalizeExistingUsers() {
  const [users] = await db.query(
    `SELECT id, phone, email, created_at, email_verified_at, phone_verified_at
     FROM users`
  );

  for (const user of users) {
    const normalizedPhone = normalizePhoneNumber(user.phone);
    const normalizedEmail = normalizeEmailAddress(user.email);
    const emailVerifiedAt = user.email_verified_at || (normalizedEmail ? user.created_at : null);
    const phoneVerifiedAt = user.phone_verified_at || (normalizedPhone ? user.created_at : null);

    await db.query(
      `UPDATE users
       SET phone = COALESCE(?, phone),
           normalized_phone = ?,
           email = ?,
           email_verified_at = ?,
           phone_verified_at = ?
       WHERE id = ?`,
      [
        normalizedPhone,
        normalizedPhone,
        normalizedEmail,
        emailVerifiedAt,
        phoneVerifiedAt,
        user.id
      ]
    );
  }
}

async function ensureAuthOtpTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS auth_otps (
      verification_id VARCHAR(64) PRIMARY KEY,
      purpose ENUM('register', 'password_reset') NOT NULL,
      user_id INT DEFAULT NULL,
      channel ENUM('email', 'phone') NOT NULL,
      destination VARCHAR(191) NOT NULL,
      code_hash VARCHAR(255) NOT NULL,
      expires_at DATETIME NOT NULL,
      resend_available_at DATETIME NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      max_attempts INT NOT NULL DEFAULT 5,
      send_count INT NOT NULL DEFAULT 1,
      verified_at DATETIME DEFAULT NULL,
      consumed_at DATETIME DEFAULT NULL,
      reset_session_hash VARCHAR(255) DEFAULT NULL,
      reset_session_expires_at DATETIME DEFAULT NULL,
      meta_json TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_auth_otps_purpose_destination (purpose, destination),
      INDEX idx_auth_otps_user (user_id),
      INDEX idx_auth_otps_expires (expires_at)
    )
  `);
}

let readyPromise = null;

async function ensureAuthSchema() {
  await ensureUsersColumns();
  await normalizeExistingUsers();
  await ensureAuthOtpTable();
}

function runEnsureAuthSchema() {
  if (!readyPromise) {
    readyPromise = ensureAuthSchema().catch(error => {
      readyPromise = null;
      throw error;
    });
  }

  return readyPromise;
}

module.exports = runEnsureAuthSchema;
