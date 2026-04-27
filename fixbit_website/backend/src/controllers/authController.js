const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const { ok, fail } = require('../utils/apiResponse');
const { inferIdentifierType, normalizeEmailAddress, normalizePhoneNumber } = require('../utils/contact');
const {
  cleanString,
  nullableString,
  isValidPhone,
  isValidEmail,
  isValidRole,
  toNumber
} = require('../utils/validation');

async function register(req, res) {
  const name = cleanString(req.body.name, 120);
  const email = normalizeEmailAddress(nullableString(req.body.email, 150));
  const phone = normalizePhoneNumber(req.body.phone);
  const password = cleanString(req.body.password, 255);
  const role = cleanString(req.body.role, 20);
  const latitude = toNumber(req.body.latitude);
  const longitude = toNumber(req.body.longitude);

  if (!name || !phone || !password || !role) {
    return fail(res, 400, 'Name, phone, password, and role are required');
  }

  if (!isValidRole(role)) {
    return fail(res, 400, 'Role must be user or shop');
  }

  if (!isValidPhone(phone)) {
    return fail(res, 400, 'Enter a valid phone number with or without country code');
  }

  if (!isValidEmail(email)) {
    return fail(res, 400, 'Enter a valid email address');
  }

  if (password.length < 6) {
    return fail(res, 400, 'Password must be at least 6 characters');
  }

  const existing = await User.findByPhoneOrEmail(phone, email);
  if (existing.length > 0) {
    return fail(res, 409, 'An account with this phone or email already exists');
  }

  const hashed = await bcrypt.hash(password, 10);
  const userId = await User.createUser({
    name,
    email,
    phone,
    password: hashed,
    role,
    latitude,
    longitude
  });

  return ok(res, 'Registration successful', { userId }, 201);
}

async function login(req, res) {
  const rawIdentifier = cleanString(req.body.identifier || req.body.email || req.body.phone, 150);
  const password = cleanString(req.body.password, 255);
  const identifier = inferIdentifierType(rawIdentifier) === 'email'
    ? normalizeEmailAddress(rawIdentifier)
    : normalizePhoneNumber(rawIdentifier);

  if (!identifier || !password) {
    return fail(res, 400, 'Email/phone and password required');
  }

  const user = await User.findByLogin(identifier);
  if (!user) {
    return fail(res, 401, 'Invalid credentials');
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return fail(res, 401, 'Invalid credentials');
  }

  if (user.banned) {
    return fail(res, 403, 'Your account has been banned. Contact support.');
  }

  if (!process.env.JWT_SECRET) {
    return fail(res, 500, 'JWT secret is not configured');
  }

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      email: user.email,
      name: user.name
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const { password: _password, ...safeUser } = user;
  
  // Update last active
  try {
    await User.updateLastActive(user.id);
  } catch (e) {
    console.error('Error updating last active', e);
  }

  return ok(res, 'Login successful', { user: safeUser, token });
}

async function socialLogin(req, res) {
  const email = cleanString(req.body.email, 150);
  const name = cleanString(req.body.name, 120);
  const provider = cleanString(req.body.provider, 50); // google or facebook

  if (!email || !name || !provider) {
    return fail(res, 400, 'Email, name, and provider are required');
  }

  let user = await User.findByLogin(email);
  if (!user) {
    // Auto register as a user
    const hashed = await bcrypt.hash(provider + Math.random().toString(), 10);
    const userId = await User.createUser({
      name,
      email,
      phone: 'Social_' + Math.floor(Math.random() * 10000000), // mock phone
      password: hashed,
      role: 'user',
      latitude: null,
      longitude: null
    });
    user = await User.findSafeById(userId);
  }

  if (user.banned) {
    return fail(res, 403, 'Your account has been banned. Contact support.');
  }

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      email: user.email,
      name: user.name
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const { password: _password, ...safeUser } = user;
  
  try {
    await User.updateLastActive(user.id);
  } catch (e) {}

  return ok(res, 'Social Login successful', { user: safeUser, token });
}

module.exports = {
  register,
  login,
  socialLogin
};
