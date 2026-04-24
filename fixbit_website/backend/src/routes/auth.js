const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  const { name, email, phone, password, role, latitude, longitude } = req.body;
  if (!phone || !password || !role) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  if (!/^\d{10}$/.test(phone)) {
    return res.status(400).json({ success: false, message: 'Phone must be 10 digits' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  }

  try {
    const [existing] = await db.query(
      'SELECT id FROM users WHERE phone = ? OR (email IS NOT NULL AND email = ?)',
      [phone, email || null]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'User already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    await db.query(
      `INSERT INTO users (name, email, phone, password, role, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, email || null, phone, hashed, role, latitude || null, longitude || null]
    );
    res.json({ success: true, message: 'Registration successful' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email/phone and password required' });
  }

  try {
    const [users] = await db.query(
      'SELECT * FROM users WHERE email = ? OR phone = ?',
      [email, email]
    );
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    // Check if user is banned
    if (user.banned) {
      return res.status(403).json({ success: false, message: 'Your account has been banned. Contact support.' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    const { password: _, ...safeUser } = user;
    res.json({ success: true, user: safeUser, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

module.exports = router;