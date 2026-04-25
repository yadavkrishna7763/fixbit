const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// ================= CLOUDINARY CONFIG =================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ================= MULTER + CLOUDINARY STORAGE =================
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'fixbit_requests',
    allowed_formats: ['jpg', 'jpeg', 'png'],
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ==================== SUBMIT REQUEST ====================
router.post('/', auth, upload.single('image'), async (req, res) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ success: false, message: 'Only users can create requests' });
  }

  const { brand, model, device_type, issue_type, description, latitude, longitude, radius } = req.body;
  const image = req.file ? req.file.filename : null;

  if (!brand || !model || !device_type || !issue_type || !description || !latitude || !longitude) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO requests (user_id, brand, model, device_type, issue_type, description, image, latitude, longitude, radius)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, brand, model, device_type, issue_type, description, image, latitude, longitude, radius || 10]
    );
    res.status(201).json({ success: true, requestId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to create request' });
  }
});

// ==================== GET NEARBY REQUESTS (SHOP) ====================
router.get('/nearby', auth, async (req, res) => {
  if (req.user.role !== 'shop') {
    return res.status(403).json({ success: false, message: 'Only shops can view nearby requests' });
  }
  const { lat, lng } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ success: false, message: 'Latitude and longitude required' });
  }

  try {
    const [requests] = await db.query(
      `SELECT r.*, u.name as user_name,
        (6371 * acos(
          cos(radians(?)) * cos(radians(r.latitude)) *
          cos(radians(r.longitude) - radians(?)) +
          sin(radians(?)) * sin(radians(r.latitude))
        )) AS distance
       FROM requests r
       JOIN users u ON r.user_id = u.id
       WHERE r.status = 'pending'
       HAVING distance <= r.radius
       ORDER BY distance ASC`,
      [lat, lng, lat]
    );
    res.json({ success: true, requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch requests' });
  }
});

// ==================== GET USER'S OWN REQUESTS ====================
router.get('/my', auth, async (req, res) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  try {
    const [requests] = await db.query(
      `SELECT r.*,
        (SELECT COUNT(*) FROM responses WHERE request_id = r.id) as response_count,
        (SELECT MIN(price) FROM responses WHERE request_id = r.id) as best_price
       FROM requests r
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch requests' });
  }
});

// ==================== GET SINGLE REQUEST ====================
router.get('/:id', auth, async (req, res) => {
  const requestId = req.params.id;
  try {
    const [requests] = await db.query(
      `SELECT r.*, u.name as user_name 
       FROM requests r 
       JOIN users u ON r.user_id = u.id 
       WHERE r.id = ?`,
      [requestId]
    );
    if (requests.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    const request = requests[0];
    if (req.user.role === 'user' && request.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (req.user.role === 'shop' && request.accepted_shop_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    res.json({ success: true, request });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch request' });
  }
});

// ==================== ACCEPT QUOTE ====================
router.put('/:id/accept', auth, async (req, res) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ success: false, message: 'Only users can accept quotes' });
  }
  const requestId = req.params.id;
  const { shop_id } = req.body;
  if (!shop_id) {
    return res.status(400).json({ success: false, message: 'shop_id is required' });
  }

  try {
    const [requests] = await db.query(
      'SELECT * FROM requests WHERE id = ? AND user_id = ?',
      [requestId, req.user.id]
    );
    if (requests.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const [responses] = await db.query(
      'SELECT id FROM responses WHERE request_id = ? AND shop_id = ?',
      [requestId, shop_id]
    );
    if (responses.length === 0) {
      return res.status(400).json({ success: false, message: 'No quote from this shop' });
    }

    await db.query(
      'UPDATE requests SET status = ?, accepted_shop_id = ? WHERE id = ?',
      ['accepted', shop_id, requestId]
    );
    res.json({ success: true, message: 'Quote accepted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to accept quote' });
  }
});

// ==================== UPDATE REQUEST STATUS (SHOP) ====================
router.put('/:id/status', auth, async (req, res) => {
  if (req.user.role !== 'shop') {
    return res.status(403).json({ success: false, message: 'Only shops can update status' });
  }
  const requestId = req.params.id;
  const { status } = req.body;
  const allowed = ['accepted', 'in_progress', 'completed', 'cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  try {
    const [requests] = await db.query(
      'SELECT user_id FROM requests WHERE id = ? AND accepted_shop_id = ?',
      [requestId, req.user.id]
    );
    if (requests.length === 0) {
      return res.status(404).json({ success: false, message: 'Request not found or not assigned to you' });
    }

    await db.query('UPDATE requests SET status = ? WHERE id = ?', [status, requestId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
});

module.exports = router;