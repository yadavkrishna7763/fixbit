const db = require('../db');

const SAFE_USER_FIELDS = `
  id, name, email, phone, role, latitude, longitude, avg_rating, banned,
  profile_image, address, working_hours, description, is_verified, completed_jobs, last_active_at, created_at
`;

async function findByPhoneOrEmail(phone, email) {
  const [rows] = await db.query(
    `SELECT id FROM users
     WHERE phone = ? OR (? IS NOT NULL AND email = ?)`,
    [phone, email, email]
  );

  return rows;
}

async function findConflictingContact(phone, email, userId) {
  const [rows] = await db.query(
    `SELECT id FROM users
     WHERE id <> ? AND (phone = ? OR (? IS NOT NULL AND email = ?))`,
    [userId, phone, email, email]
  );

  return rows[0] || null;
}

async function findByLogin(identifier) {
  const [rows] = await db.query(
    'SELECT * FROM users WHERE email = ? OR phone = ? LIMIT 1',
    [identifier, identifier]
  );

  return rows[0] || null;
}

async function findSafeById(id) {
  const [rows] = await db.query(
    `SELECT ${SAFE_USER_FIELDS} FROM users WHERE id = ? LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function createUser(user) {
  const [result] = await db.query(
    `INSERT INTO users (name, email, phone, password, role, latitude, longitude)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      user.name,
      user.email,
      user.phone,
      user.password,
      user.role,
      user.latitude,
      user.longitude
    ]
  );

  return result.insertId;
}

async function updateProfile(userId, profile) {
  await db.query(
    `UPDATE users
     SET name = ?, email = ?, phone = ?, address = ?, working_hours = ?, description = ?
     WHERE id = ?`,
    [
      profile.name,
      profile.email,
      profile.phone,
      profile.address,
      profile.working_hours,
      profile.description,
      userId
    ]
  );
}

async function updateLocation(userId, latitude, longitude) {
  await db.query(
    'UPDATE users SET latitude = ?, longitude = ? WHERE id = ?',
    [latitude, longitude, userId]
  );
}

async function updateProfileImage(userId, imageUrl) {
  await db.query('UPDATE users SET profile_image = ? WHERE id = ?', [imageUrl, userId]);
}

async function listUsers() {
  const [rows] = await db.query(
    `SELECT id, name, email, phone, role, latitude, longitude, avg_rating, banned, created_at
     FROM users
     ORDER BY created_at DESC`
  );

  return rows;
}

async function setBanned(userId, banned) {
  await db.query('UPDATE users SET banned = ? WHERE id = ?', [banned ? 1 : 0, userId]);
}

async function searchShops({ q, limit }) {
  const params = [];
  let sql = `
    SELECT id, name, phone, latitude, longitude, avg_rating, profile_image, address, working_hours, description, is_verified, completed_jobs, last_active_at
    FROM users
    WHERE role = 'shop' AND banned = 0
  `;

  if (q) {
    sql += ' AND name LIKE ?';
    params.push(`%${q}%`);
  }

  sql += ' ORDER BY COALESCE(avg_rating, 0) DESC, name ASC LIMIT ?';
  params.push(limit);

  const [rows] = await db.query(sql, params);
  return rows;
}

async function incrementCompletedJobs(userId) {
  await db.query('UPDATE users SET completed_jobs = completed_jobs + 1 WHERE id = ?', [userId]);
}

async function updateLastActive(userId) {
  await db.query('UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
}

module.exports = {
  findByPhoneOrEmail,
  findConflictingContact,
  findByLogin,
  findSafeById,
  createUser,
  updateProfile,
  updateLocation,
  updateProfileImage,
  listUsers,
  setBanned,
  searchShops,
  incrementCompletedJobs,
  updateLastActive
};
