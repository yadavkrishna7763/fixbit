const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// Shop sends a quote
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'shop') {
    return res.status(403).json({ success: false, message: 'Only shops can send quotes' });
  }

  const { request_id, price, message } = req.body;
  if (!request_id || !price) {
    return res.status(400).json({ success: false, message: 'Request ID and price required' });
  }

  try {
    await db.query(
      `INSERT INTO responses (request_id, shop_id, price, message)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE price = VALUES(price), message = VALUES(message)`,
      [request_id, req.user.id, price, message || '']
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to send quote' });
  }
});

// Get quotes for a specific request (user/shop)
router.get('/request/:requestId', auth, async (req, res) => {
  const requestId = req.params.requestId;

  try {
    const [responses] = await db.query(
      `SELECT r.*, u.name as shop_name, u.phone as shop_phone, u.avg_rating
       FROM responses r
       JOIN users u ON r.shop_id = u.id
       WHERE r.request_id = ?
       ORDER BY r.price ASC`,
      [requestId]
    );
    res.json({ success: true, responses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch quotes' });
  }
});

// Get all quotes sent by a shop
router.get('/shop', auth, async (req, res) => {
  if (req.user.role !== 'shop') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  try {
    const [quotes] = await db.query(
      `SELECT r.*, 
              req.brand, req.model, req.issue_type, req.status as request_status, 
              u.name as user_name, u.id as user_id    -- ← ADD u.id as user_id
       FROM responses r
       JOIN requests req ON r.request_id = req.id
       JOIN users u ON req.user_id = u.id
       WHERE r.shop_id = ?
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, quotes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch quotes' });
  }
});

module.exports = router;