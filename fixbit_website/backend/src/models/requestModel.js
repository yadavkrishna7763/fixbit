const db = require('../db');

async function createRequest(request) {
  const [result] = await db.query(
    `INSERT INTO requests
      (user_id, brand, model, device_type, issue_type, description, image, latitude, longitude, radius)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      request.user_id,
      request.brand,
      request.model,
      request.device_type,
      request.issue_type,
      request.description,
      request.image,
      request.latitude,
      request.longitude,
      request.radius
    ]
  );

  return result.insertId;
}

async function listNearby({ shopId, latitude, longitude }) {
  const [rows] = await db.query(
    `SELECT r.*, u.name AS user_name,
      EXISTS(
        SELECT 1 FROM responses resp
        WHERE resp.request_id = r.id AND resp.shop_id = ?
      ) AS has_quoted,
      (6371 * acos(
        LEAST(1, GREATEST(-1,
          cos(radians(?)) * cos(radians(r.latitude)) *
          cos(radians(r.longitude) - radians(?)) +
          sin(radians(?)) * sin(radians(r.latitude))
        ))
      )) AS distance
     FROM requests r
     JOIN users u ON r.user_id = u.id
     WHERE r.status = 'pending'
       AND u.banned = 0
       AND r.latitude IS NOT NULL
       AND r.longitude IS NOT NULL
     HAVING distance <= COALESCE(r.radius, 10)
     ORDER BY has_quoted ASC, distance ASC, r.created_at DESC`,
    [shopId, latitude, longitude, latitude]
  );

  return rows;
}

async function listByUser(userId) {
  const [rows] = await db.query(
    `SELECT r.*,
      (SELECT COUNT(*) FROM responses WHERE request_id = r.id) AS response_count,
      (SELECT MIN(price) FROM responses WHERE request_id = r.id) AS best_price,
      EXISTS(SELECT 1 FROM reviews WHERE request_id = r.id AND user_id = ?) AS reviewed
     FROM requests r
     WHERE r.user_id = ?
     ORDER BY r.created_at DESC`,
    [userId, userId]
  );

  return rows;
}

async function findById(requestId) {
  const [rows] = await db.query(
    `SELECT r.*, u.name AS user_name, u.phone AS user_phone
     FROM requests r
     JOIN users u ON r.user_id = u.id
     WHERE r.id = ?
     LIMIT 1`,
    [requestId]
  );

  return rows[0] || null;
}

async function hasQuoteFromShop(requestId, shopId) {
  const [rows] = await db.query(
    'SELECT id FROM responses WHERE request_id = ? AND shop_id = ? LIMIT 1',
    [requestId, shopId]
  );

  return rows.length > 0;
}

async function acceptQuote(requestId, shopId) {
  await db.query(
    `UPDATE requests
     SET status = 'accepted', accepted_shop_id = ?
     WHERE id = ?`,
    [shopId, requestId]
  );
}

async function updateStatusForShop(requestId, shopId, status) {
  const [result] = await db.query(
    `UPDATE requests
     SET status = ?
     WHERE id = ? AND accepted_shop_id = ?`,
    [status, requestId, shopId]
  );

  return result.affectedRows;
}

async function listAllForAdmin() {
  const [rows] = await db.query(
    `SELECT r.*, u.name AS user_name, s.name AS shop_name
     FROM requests r
     JOIN users u ON r.user_id = u.id
     LEFT JOIN users s ON r.accepted_shop_id = s.id
     ORDER BY r.created_at DESC`
  );

  return rows;
}

async function deleteById(requestId) {
  await db.query('DELETE FROM requests WHERE id = ?', [requestId]);
}

module.exports = {
  createRequest,
  listNearby,
  listByUser,
  findById,
  hasQuoteFromShop,
  acceptQuote,
  updateStatusForShop,
  listAllForAdmin,
  deleteById
};
