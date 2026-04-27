const bcrypt = require('bcrypt');
const db = require('../db');
const { normalizePhoneNumber } = require('./contact');

const SHOP_SEEDS = [
  { name: 'Shri Kalka Mobile Repair', phone: '8744841920', latitude: 28.5495, longitude: 77.2506 },
  { name: 'Expert Team', phone: '9576152569', latitude: 28.5495, longitude: 77.2516 },
  { name: 'BRC Computer', phone: '8799705881', latitude: 28.5505, longitude: 77.2506 },
  { name: 'Fone Box', phone: '9958811539', latitude: 28.5495, longitude: 77.2496 },
  { name: 'JMK', phone: '8537858585', latitude: 28.5485, longitude: 77.2506 },
  { name: 'Mobi World', phone: '8285744902', latitude: 28.5502, longitude: 77.2513 }
];

let readyPromise = null;

async function ensureSeedShops() {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count
     FROM users
     WHERE role = 'shop'`
  );

  if (Number(rows[0]?.count || 0) > 0) {
    return;
  }

  const passwordHash = await bcrypt.hash(process.env.DEFAULT_SEED_SHOP_PASSWORD || 'shop123', 10);

  for (const shop of SHOP_SEEDS) {
    const normalizedPhone = normalizePhoneNumber(shop.phone);
    await db.query(
      `INSERT INTO users
        (name, email, phone, normalized_phone, password, role, latitude, longitude, banned, created_at)
       VALUES (?, NULL, ?, ?, ?, 'shop', ?, ?, 0, NOW())`,
      [
        shop.name,
        normalizedPhone,
        normalizedPhone,
        passwordHash,
        shop.latitude,
        shop.longitude
      ]
    );
  }
}

function runEnsureSeedShops() {
  if (!readyPromise) {
    readyPromise = ensureSeedShops().catch(error => {
      readyPromise = null;
      throw error;
    });
  }

  return readyPromise;
}

module.exports = runEnsureSeedShops;
