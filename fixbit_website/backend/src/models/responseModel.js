const db = require('../db');

async function upsertQuote({ requestId, shopId, price, message }) {
  await db.query(
    `INSERT INTO responses (request_id, shop_id, price, message)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       price = VALUES(price),
       message = VALUES(message),
       updated_at = CURRENT_TIMESTAMP`,
    [requestId, shopId, price, message]
  );
}

async function listForRequest(requestId) {
  const [rows] = await db.query(
    `SELECT r.*, u.name AS shop_name, u.phone AS shop_phone, u.avg_rating AS shop_avg_rating,
            u.is_verified AS shop_is_verified, u.completed_jobs AS shop_completed_jobs,
            u.latitude AS shop_latitude, u.longitude AS shop_longitude
     FROM responses r
     JOIN users u ON r.shop_id = u.id
     WHERE r.request_id = ? AND u.banned = 0
     ORDER BY r.price ASC, r.created_at ASC`,
    [requestId]
  );

  return rows;
}

async function listForShop(shopId) {
  const [rows] = await db.query(
    `SELECT r.*,
      req.brand,
      req.model,
      req.device_type,
      req.issue_type,
      req.status AS request_status,
      req.accepted_shop_id,
      u.name AS user_name,
      u.id AS user_id
     FROM responses r
     JOIN requests req ON r.request_id = req.id
     JOIN users u ON req.user_id = u.id
     WHERE r.shop_id = ?
     ORDER BY r.created_at DESC`,
    [shopId]
  );

  return rows;
}

module.exports = {
  upsertQuote,
  listForRequest,
  listForShop
};
