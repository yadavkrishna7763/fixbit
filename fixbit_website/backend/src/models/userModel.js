const db = require('../db');
const { normalizeEmailAddress, normalizePhoneNumber } = require('../utils/contact');

const SAFE_USER_FIELDS = `
  id, name, email, phone, role, latitude, longitude, avg_rating, banned,
  profile_image, address, working_hours, description, is_verified, completed_jobs, last_active_at, created_at
`;

async function findByPhoneOrEmail(phone, email) {
  const normalizedPhone = normalizePhoneNumber(phone);
  const normalizedEmail = normalizeEmailAddress(email);
  const [rows] = await db.query(
    `SELECT id FROM users
     WHERE phone = ?
        OR normalized_phone = ?
        OR (? IS NOT NULL AND email = ?)`,
    [normalizedPhone || phone, normalizedPhone, normalizedEmail, normalizedEmail]
  );

  return rows;
}

async function findConflictingContact(phone, email, userId) {
  const normalizedPhone = normalizePhoneNumber(phone);
  const normalizedEmail = normalizeEmailAddress(email);
  const [rows] = await db.query(
    `SELECT id FROM users
     WHERE id <> ?
       AND (
         phone = ?
         OR normalized_phone = ?
         OR (? IS NOT NULL AND email = ?)
       )`,
    [userId, normalizedPhone || phone, normalizedPhone, normalizedEmail, normalizedEmail]
  );

  return rows[0] || null;
}

async function findByLogin(identifier) {
  const normalizedIdentifier = normalizePhoneNumber(identifier);
  const normalizedEmail = normalizeEmailAddress(identifier);
  const [rows] = await db.query(
    `SELECT * FROM users
     WHERE email = ?
        OR phone = ?
        OR normalized_phone = ?
     LIMIT 1`,
    [normalizedEmail || identifier, normalizedIdentifier || identifier, normalizedIdentifier]
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
  const normalizedPhone = normalizePhoneNumber(user.phone);
  const normalizedEmail = normalizeEmailAddress(user.email);
  const [result] = await db.query(
    `INSERT INTO users (name, email, phone, normalized_phone, password, role, latitude, longitude)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.name,
      normalizedEmail,
      normalizedPhone || user.phone,
      normalizedPhone,
      user.password,
      user.role,
      user.latitude,
      user.longitude
    ]
  );

  return result.insertId;
}

async function updateProfile(userId, profile) {
  const normalizedPhone = normalizePhoneNumber(profile.phone);
  const normalizedEmail = normalizeEmailAddress(profile.email);
  await db.query(
    `UPDATE users
     SET name = ?, email = ?, phone = ?, normalized_phone = ?, address = ?, working_hours = ?, description = ?
     WHERE id = ?`,
    [
      profile.name,
      normalizedEmail,
      normalizedPhone || profile.phone,
      normalizedPhone,
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
