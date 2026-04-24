const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// Submit a review
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ success: false, message: 'Only users can submit reviews' });
  }
  const { request_id, rating, comment } = req.body;
  if (!request_id || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: 'Invalid review data' });
  }

  try {
    const [requests] = await db.query(
      'SELECT * FROM requests WHERE id = ? AND user_id = ? AND status = ?',
      [request_id, req.user.id, 'completed']
    );
    if (requests.length === 0) {
      return res.status(400).json({ success: false, message: 'Request not found or not completed' });
    }
    const shopId = requests[0].accepted_shop_id;
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'No shop associated' });
    }

    await db.query(
      `INSERT INTO reviews (request_id, user_id, shop_id, rating, comment)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment)`,
      [request_id, req.user.id, shopId, rating, comment || '']
    );

    const [avgResult] = await db.query(
      'SELECT AVG(rating) as avg_rating FROM reviews WHERE shop_id = ?',
      [shopId]
    );
    await db.query('UPDATE users SET avg_rating = ? WHERE id = ?', [avgResult[0].avg_rating, shopId]);

    res.json({ success: true, message: 'Review submitted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to submit review' });
  }
});

// Get shop reviews
router.get('/shop/:shopId', async (req, res) => {
  try {
    const [reviews] = await db.query(
      `SELECT r.*, u.name as user_name 
       FROM reviews r 
       JOIN users u ON r.user_id = u.id 
       WHERE r.shop_id = ? 
       ORDER BY r.created_at DESC`,
      [req.params.shopId]
    );
    res.json({ success: true, reviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
  }
});

module.exports = router;