const db = require('../db');

async function createNotification({ userId, type, title, body, meta = null }) {
  const serializedMeta = meta ? JSON.stringify(meta) : null;
  const [result] = await db.query(
    `INSERT INTO notifications (user_id, type, title, body, meta)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, type, title, body, serializedMeta]
  );
  return result.insertId;
}

async function listForUser(userId, limit = 30) {
  const [rows] = await db.query(
    `SELECT *
     FROM notifications
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [userId, Number(limit)]
  );
  return rows.map(row => ({
    ...row,
    meta: row.meta ? safeParseJson(row.meta) : null
  }));
}

async function markRead(notificationId, userId) {
  const [result] = await db.query(
    `UPDATE notifications
     SET is_read = 1
     WHERE id = ? AND user_id = ?`,
    [notificationId, userId]
  );
  return result.affectedRows;
}

async function markAllRead(userId) {
  await db.query(
    `UPDATE notifications
     SET is_read = 1
     WHERE user_id = ?`,
    [userId]
  );
}

function safeParseJson(value) {
  try {
    return JSON.parse(value);
  } catch (e) {
    return null;
  }
}

module.exports = {
  createNotification,
  listForUser,
  markRead,
  markAllRead
};
