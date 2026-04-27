const db = require('../db');

async function findRecentDuplicate({ requestId, senderId, receiverId, body }) {
  const [rows] = await db.query(
    `SELECT id FROM messages
     WHERE request_id = ?
       AND sender_id = ?
       AND receiver_id = ?
       AND body = ?
       AND created_at >= (NOW() - INTERVAL 5 SECOND)
     ORDER BY id DESC
     LIMIT 1`,
    [requestId, senderId, receiverId, body]
  );

  return rows[0] || null;
}

async function createMessage({ requestId, senderId, receiverId, body }) {
  const [result] = await db.query(
    `INSERT INTO messages (request_id, sender_id, receiver_id, body)
     VALUES (?, ?, ?, ?)`,
    [requestId, senderId, receiverId, body]
  );

  return result.insertId;
}

async function listForRequest(requestId) {
  const [rows] = await db.query(
    `SELECT m.*, u.name AS sender_name
     FROM messages m
     JOIN users u ON m.sender_id = u.id
     WHERE m.request_id = ?
     ORDER BY m.created_at ASC, m.id ASC`,
    [requestId]
  );

  return rows;
}

async function markRead(requestId, receiverId) {
  await db.query(
    'UPDATE messages SET is_read = TRUE WHERE request_id = ? AND receiver_id = ?',
    [requestId, receiverId]
  );
}

module.exports = {
  findRecentDuplicate,
  createMessage,
  listForRequest,
  markRead
};
