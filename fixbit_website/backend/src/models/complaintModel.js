const db = require('../db');

async function create(userId, subject, description) {
  const [result] = await db.query(
    'INSERT INTO complaints (user_id, subject, description) VALUES (?, ?, ?)',
    [userId, subject, description]
  );
  return result.insertId;
}

async function listAll() {
  const [rows] = await db.query(`
    SELECT c.*, u.name as user_name, u.email as user_email, u.phone as user_phone, u.role as user_role
    FROM complaints c
    JOIN users u ON c.user_id = u.id
    ORDER BY c.created_at DESC
  `);
  return rows;
}

async function listByUser(userId) {
  const [rows] = await db.query(
    'SELECT * FROM complaints WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows;
}

async function resolve(id, adminResponse) {
  await db.query(
    'UPDATE complaints SET status = ?, admin_response = ? WHERE id = ?',
    ['resolved', adminResponse, id]
  );
}

module.exports = {
  create,
  listAll,
  listByUser,
  resolve
};
