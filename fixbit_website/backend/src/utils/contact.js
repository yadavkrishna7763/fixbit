const DEFAULT_PHONE_COUNTRY_CODE = String(process.env.DEFAULT_PHONE_COUNTRY_CODE || '91').replace(/\D/g, '') || '91';
const LOCAL_PHONE_LENGTH = Number(process.env.LOCAL_PHONE_LENGTH || 10);

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeEmailAddress(value) {
  const cleaned = String(value || '').trim().toLowerCase();
  return cleaned || null;
}

function normalizePhoneNumber(value, options = {}) {
  const countryCode = String(options.defaultCountryCode || DEFAULT_PHONE_COUNTRY_CODE).replace(/\D/g, '') || DEFAULT_PHONE_COUNTRY_CODE;
  const localLength = Number(options.localLength || LOCAL_PHONE_LENGTH);
  const cleaned = String(value || '').trim();
  if (!cleaned) return null;

  const digits = digitsOnly(cleaned);
  if (!digits) return null;

  if (digits.length === localLength) {
    return `+${countryCode}${digits}`;
  }

  if (digits.length === countryCode.length + localLength && digits.startsWith(countryCode)) {
    return `+${digits}`;
  }

  return null;
}

function inferIdentifierType(identifier) {
  return String(identifier || '').includes('@') ? 'email' : 'phone';
}

function maskEmailAddress(email) {
  const normalized = normalizeEmailAddress(email);
  if (!normalized) return '';

  const [localPart, domain] = normalized.split('@');
  if (!domain) return normalized;

  const visibleLocal = localPart.length <= 2
    ? `${localPart[0] || ''}*`
    : `${localPart.slice(0, 2)}${'*'.repeat(Math.max(1, localPart.length - 2))}`;

  const [domainName, ...domainRest] = domain.split('.');
  const visibleDomain = domainName.length <= 2
    ? `${domainName[0] || ''}*`
    : `${domainName.slice(0, 2)}${'*'.repeat(Math.max(1, domainName.length - 2))}`;

  return `${visibleLocal}@${visibleDomain}${domainRest.length ? `.${domainRest.join('.')}` : ''}`;
}

function maskPhoneNumber(phone) {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return '';

  const digits = digitsOnly(normalized);
  const countryCode = digits.slice(0, Math.max(0, digits.length - LOCAL_PHONE_LENGTH));
  const local = digits.slice(-LOCAL_PHONE_LENGTH);
  return `+${countryCode}${'*'.repeat(Math.max(0, LOCAL_PHONE_LENGTH - 4))}${local.slice(-4)}`;
}

function maskContact(channel, value) {
  return channel === 'email'
    ? maskEmailAddress(value)
    : maskPhoneNumber(value);
}

module.exports = {
  DEFAULT_PHONE_COUNTRY_CODE,
  LOCAL_PHONE_LENGTH,
  digitsOnly,
  normalizeEmailAddress,
  normalizePhoneNumber,
  inferIdentifierType,
  maskEmailAddress,
  maskPhoneNumber,
  maskContact
};
