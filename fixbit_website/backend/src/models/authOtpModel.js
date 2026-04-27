const db = require('../db');

function parseMeta(metaJson) {
  if (!metaJson) return {};
  try {
    return JSON.parse(metaJson);
  } catch (e) {
    return {};
  }
}

function mapRow(row) {
  if (!row) return null;
  return {
    ...row,
    meta: parseMeta(row.meta_json)
  };
}

async function deleteOpenByPurposeAndDestination(purpose, destination) {
  await db.query(
    `DELETE FROM auth_otps
     WHERE purpose = ?
       AND destination = ?
       AND consumed_at IS NULL`,
    [purpose, destination]
  );
}

async function createVerification({
  verificationId,
  purpose,
  userId = null,
  channel,
  destination,
  codeHash,
  expiresAt,
  resendAvailableAt,
  maxAttempts,
  meta = {}
}) {
  await db.query(
    `INSERT INTO auth_otps
      (verification_id, purpose, user_id, channel, destination, code_hash, expires_at, resend_available_at, max_attempts, meta_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      verificationId,
      purpose,
      userId,
      channel,
      destination,
      codeHash,
      expiresAt,
      resendAvailableAt,
      maxAttempts,
      JSON.stringify(meta)
    ]
  );

  return findByVerificationId(verificationId);
}

async function findByVerificationId(verificationId) {
  const [rows] = await db.query(
    'SELECT * FROM auth_otps WHERE verification_id = ? LIMIT 1',
    [verificationId]
  );
  return mapRow(rows[0] || null);
}

async function incrementAttempts(verificationId) {
  await db.query(
    'UPDATE auth_otps SET attempts = attempts + 1 WHERE verification_id = ?',
    [verificationId]
  );
}

async function updateCodeForResend({ verificationId, codeHash, expiresAt, resendAvailableAt }) {
  await db.query(
    `UPDATE auth_otps
     SET code_hash = ?,
         expires_at = ?,
         resend_available_at = ?,
         send_count = send_count + 1,
         attempts = 0,
         verified_at = NULL,
         reset_session_hash = NULL,
         reset_session_expires_at = NULL
     WHERE verification_id = ?`,
    [codeHash, expiresAt, resendAvailableAt, verificationId]
  );

  return findByVerificationId(verificationId);
}

async function markConsumed(verificationId) {
  await db.query(
    `UPDATE auth_otps
     SET consumed_at = CURRENT_TIMESTAMP
     WHERE verification_id = ?`,
    [verificationId]
  );
}

async function storeResetSession({ verificationId, resetSessionHash, resetSessionExpiresAt }) {
  await db.query(
    `UPDATE auth_otps
     SET verified_at = CURRENT_TIMESTAMP,
         reset_session_hash = ?,
         reset_session_expires_at = ?
     WHERE verification_id = ?`,
    [resetSessionHash, resetSessionExpiresAt, verificationId]
  );

  return findByVerificationId(verificationId);
}

async function findByResetSessionHash(resetSessionHash) {
  const [rows] = await db.query(
    `SELECT * FROM auth_otps
     WHERE reset_session_hash = ?
       AND reset_session_expires_at IS NOT NULL
       AND reset_session_expires_at > NOW()
       AND consumed_at IS NULL
     LIMIT 1`,
    [resetSessionHash]
  );

  return mapRow(rows[0] || null);
}

module.exports = {
  deleteOpenByPurposeAndDestination,
  createVerification,
  findByVerificationId,
  incrementAttempts,
  updateCodeForResend,
  markConsumed,
  storeResetSession,
  findByResetSessionHash
};
