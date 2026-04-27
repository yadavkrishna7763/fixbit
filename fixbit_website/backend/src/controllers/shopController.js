const User = require('../models/userModel');
const { ok, fail } = require('../utils/apiResponse');
const { cleanString, toNumber, toPositiveInteger } = require('../utils/validation');

async function updateLocation(req, res) {
  const latitude = toNumber(req.body.latitude);
  const longitude = toNumber(req.body.longitude);

  if (latitude === null || longitude === null) {
    return fail(res, 400, 'Latitude and longitude are required');
  }

  await User.updateLocation(req.user.id, latitude, longitude);
  return ok(res, 'Location updated');
}

async function searchShops(req, res) {
  const q = cleanString(req.query.q, 80);
  const lat = toNumber(req.query.lat);
  const lng = toNumber(req.query.lng);
  const limit = Math.min(toPositiveInteger(req.query.limit, 100), 100);

  const shops = await User.searchShops({ q, limit });

  if (lat !== null && lng !== null) {
    shops.forEach(shop => {
      if (shop.latitude !== null && shop.longitude !== null) {
        shop.distance = distanceKm(lat, lng, Number(shop.latitude), Number(shop.longitude));
      } else {
        shop.distance = null;
      }
    });

    shops.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  }

  return ok(res, 'Shops loaded', { shops });
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const radius = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return radius * c;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

module.exports = {
  updateLocation,
  searchShops
};
