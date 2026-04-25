const db = require('../db');

async function upsertReview({ requestId, userId, shopId, rating, comment }) {
  await db.query(
    `INSERT INTO reviews (request_id, user_id, shop_id, rating, comment)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment)`,
    [requestId, userId, shopId, rating, comment]
  );
}

async function updateShopAverage(shopId) {
  const [avgRows] = await db.query(
    'SELECT AVG(rating) AS avg_rating FROM reviews WHERE shop_id = ?',
    [shopId]
  );

  await db.query('UPDATE users SET avg_rating = ? WHERE id = ?', [avgRows[0].avg_rating, shopId]);
}

async function listForShop(shopId) {
  const [rows] = await db.query(
    `SELECT r.*, u.name AS user_name
     FROM reviews r
     JOIN users u ON r.user_id = u.id
     WHERE r.shop_id = ?
     ORDER BY r.created_at DESC`,
    [shopId]
  );

  return rows;
}

module.exports = {
  upsertReview,
  updateShopAverage,
  listForShop
};
