const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// Update shop location
router.put('/location', auth, async (req, res) => {
  if (req.user.role !== 'shop') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }
  const { latitude, longitude } = req.body;
  try {
    await db.query('UPDATE users SET latitude = ?, longitude = ? WHERE id = ?',
      [latitude, longitude, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update location' });
  }
});

// Search shops
router.get('/search', async (req, res) => {
  const { q, lat, lng } = req.query;
  let sql = `SELECT id, name, phone, latitude, longitude, avg_rating FROM users WHERE role = 'shop'`;
  const params = [];

  if (q) {
    sql += ` AND name LIKE ?`;
    params.push(`%${q}%`);
  }

  try {
    const [shops] = await db.query(sql, params);
    if (lat && lng) {
      shops.forEach(shop => {
        if (shop.latitude && shop.longitude) {
          shop.distance = getDistanceFromLatLonInKm(lat, lng, shop.latitude, shop.longitude);
        } else {
          shop.distance = null;
        }
      });
      shops.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
    }
    res.json({ success: true, shops });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Search failed' });
  }
});

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

module.exports = router;