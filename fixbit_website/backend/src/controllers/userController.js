const User = require('../models/userModel');
const ShopImage = require('../models/shopImageModel');
const { ok, fail } = require('../utils/apiResponse');
const {
  cleanString,
  nullableString,
  isValidPhone,
  isValidEmail
} = require('../utils/validation');

async function getProfile(req, res) {
  const profile = await User.findSafeById(req.user.id);
  if (!profile) {
    return fail(res, 404, 'User not found');
  }

  return ok(res, 'Profile loaded', { profile });
}

async function updateProfile(req, res) {
  const name = cleanString(req.body.name, 120);
  const email = nullableString(req.body.email, 150);
  const phone = cleanString(req.body.phone, 20);
  const address = nullableString(req.body.address, 1000);
  const working_hours = nullableString(req.body.working_hours, 100);
  const description = nullableString(req.body.description, 1000);

  if (!name || !phone) {
    return fail(res, 400, 'Name and phone are required');
  }

  if (!isValidPhone(phone)) {
    return fail(res, 400, 'Phone must be 10 digits');
  }

  if (!isValidEmail(email)) {
    return fail(res, 400, 'Enter a valid email address');
  }

  const conflict = await User.findConflictingContact(phone, email, req.user.id);
  if (conflict) {
    return fail(res, 409, 'Another account already uses this phone or email');
  }

  await User.updateProfile(req.user.id, {
    name,
    email,
    phone,
    address,
    working_hours,
    description
  });

  const profile = await User.findSafeById(req.user.id);
  return ok(res, 'Profile updated', { profile });
}

async function uploadProfileImage(req, res) {
  if (!req.file) {
    return fail(res, 400, 'No image uploaded');
  }

  const imageUrl = `/uploads/profiles/${req.file.filename}`;
  await User.updateProfileImage(req.user.id, imageUrl);

  return ok(res, 'Profile picture updated', { imageUrl });
}

async function uploadShopImages(req, res) {
  if (req.user.role !== 'shop') {
    return fail(res, 403, 'Shops only');
  }

  if (!req.files || req.files.length === 0) {
    return fail(res, 400, 'No images uploaded');
  }

  await Promise.all(
    req.files.map(file => ShopImage.addShopImage(req.user.id, `/uploads/profiles/${file.filename}`))
  );

  return ok(res, `${req.files.length} images uploaded`);
}

async function getShopImages(req, res) {
  const shopId = Number(req.params.shopId);
  if (!Number.isInteger(shopId) || shopId <= 0) {
    return fail(res, 400, 'Invalid shop id');
  }

  const images = await ShopImage.listShopImages(shopId);
  return ok(res, 'Shop images loaded', { images });
}

module.exports = {
  getProfile,
  updateProfile,
  uploadProfileImage,
  uploadShopImages,
  getShopImages
};
