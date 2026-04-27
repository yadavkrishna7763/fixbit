const db = require('../db');

async function addShopImage(shopId, imageUrl) {
  await db.query(
    'INSERT INTO shop_images (shop_id, image_url) VALUES (?, ?)',
    [shopId, imageUrl]
  );
}

async function listShopImages(shopId) {
  const [rows] = await db.query(
    `SELECT id, image_url, is_primary
     FROM shop_images
     WHERE shop_id = ?
     ORDER BY is_primary DESC, created_at DESC`,
    [shopId]
  );

  return rows;
}

module.exports = {
  addShopImage,
  listShopImages
};
