const { normalizePhoneNumber } = require('./contact');

const VALID_ROLES = new Set(['user', 'shop']);

function cleanString(value, maxLength = 1000) {
  if (value === undefined || value === null) return '';

  return String(value)
    .replace(/\0/g, '')
    .trim()
    .slice(0, maxLength);
}

function nullableString(value, maxLength = 1000) {
  const cleaned = cleanString(value, maxLength);
  return cleaned || null;
}

function isValidPhone(phone) {
  return Boolean(normalizePhoneNumber(cleanString(phone, 32)));
}

function isValidEmail(email) {
  const cleaned = cleanString(email, 150);
  if (!cleaned) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned);
}

function isValidRole(role) {
  return VALID_ROLES.has(cleanString(role, 20));
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toPositiveNumber(value) {
  const number = toNumber(value);
  return number && number > 0 ? number : null;
}

function toPositiveInteger(value, fallback = null) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function requireFields(source, fields) {
  return fields.filter(field => cleanString(source[field]) === '');
}

module.exports = {
  cleanString,
  nullableString,
  isValidPhone,
  isValidEmail,
  isValidRole,
  toNumber,
  toPositiveNumber,
  toPositiveInteger,
  requireFields
};
