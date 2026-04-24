const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// Send a message
router.post('/', auth, async (req, res) => {
  const { request_id, receiver_id, body } = req.body;
  if (!request_id || !receiver_id || !body) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  try {
    // Verify the sender is either the user or the accepted shop for this request
    const [requests] = await db.query(
      'SELECT user_id, accepted_shop_id FROM requests WHERE id = ?',
      [request_id]
    );
    if (requests.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    const reqData = requests[0];
    const senderId = req.user.id;
    if (senderId !== reqData.user_id && senderId !== reqData.accepted_shop_id) {
      return res.status(403).json({ success: false, message: 'Not authorized for this request' });
    }

    await db.query(
      'INSERT INTO messages (request_id, sender_id, receiver_id, body) VALUES (?, ?, ?, ?)',
      [request_id, senderId, receiver_id, body]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

// Get conversation for a request
router.get('/request/:requestId', auth, async (req, res) => {
  const requestId = req.params.requestId;
  try {
    const [requests] = await db.query(
      'SELECT user_id, accepted_shop_id FROM requests WHERE id = ?',
      [requestId]
    );
    if (requests.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    const reqData = requests[0];
    const userId = req.user.id;
    if (userId !== reqData.user_id && userId !== reqData.accepted_shop_id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const [messages] = await db.query(
      `SELECT m.*, u.name as sender_name 
       FROM messages m 
       JOIN users u ON m.sender_id = u.id 
       WHERE m.request_id = ? 
       ORDER BY m.created_at ASC`,
      [requestId]
    );
    res.json({ success: true, messages });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
});

// Mark messages as read
router.put('/read/:requestId', auth, async (req, res) => {
  const requestId = req.params.requestId;
  try {
    await db.query(
      'UPDATE messages SET is_read = TRUE WHERE request_id = ? AND receiver_id = ?',
      [requestId, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update read status' });
  }
});

module.exports = router;