const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads/profiles');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

// GET profile
router.get('/profile', auth, async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, name, email, phone, role, profile_image, address, working_hours, description, latitude, longitude, avg_rating FROM users WHERE id = ?',
      [req.user.id]
    );
    if (users.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, profile: users[0] });
  } catch (err) {
    console.error('GET profile error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// UPDATE profile
router.put('/profile', auth, async (req, res) => {
  const { name, email, phone, address, working_hours, description } = req.body;
  try {
    await db.query(
      `UPDATE users SET name = ?, email = ?, phone = ?, address = ?, working_hours = ?, description = ? WHERE id = ?`,
      [name || null, email || null, phone || null, address || null, working_hours || null, description || null, req.user.id]
    );
    res.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    console.error('PUT profile error:', err);
    res.status(500).json({ success: false, message: 'Update failed' });
  }
});

// UPLOAD profile image
router.post('/profile/image', auth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });
  const imageUrl = `/uploads/profiles/${req.file.filename}`;
  try {
    await db.query('UPDATE users SET profile_image = ? WHERE id = ?', [imageUrl, req.user.id]);
    res.json({ success: true, imageUrl });
  } catch (err) {
    console.error('POST profile/image error:', err);
    res.status(500).json({ success: false, message: 'Failed to update image' });
  }
});

// UPLOAD multiple shop images
router.post('/shop/images', auth, upload.array('images', 5), async (req, res) => {
  if (req.user.role !== 'shop') return res.status(403).json({ success: false, message: 'Shops only' });
  const files = req.files;
  if (!files.length) return res.status(400).json({ success: false, message: 'No images uploaded' });
  try {
    for (const file of files) {
      const imageUrl = `/uploads/profiles/${file.filename}`;
      await db.query('INSERT INTO shop_images (shop_id, image_url) VALUES (?, ?)', [req.user.id, imageUrl]);
    }
    res.json({ success: true, message: `${files.length} images uploaded` });
  } catch (err) {
    console.error('POST shop/images error:', err);
    res.status(500).json({ success: false, message: 'Failed to upload images' });
  }
});

// GET shop images
router.get('/shop/:shopId/images', async (req, res) => {
  try {
    const [images] = await db.query('SELECT id, image_url, is_primary FROM shop_images WHERE shop_id = ? ORDER BY is_primary DESC, created_at DESC', [req.params.shopId]);
    res.json({ success: true, images });
  } catch (err) {
    console.error('GET shop/images error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch images' });
  }
});

module.exports = router;