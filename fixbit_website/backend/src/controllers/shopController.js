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
  const minRating = toNumber(req.query.minRating);
  const maxDistance = toNumber(req.query.maxDistance);
  const sortBy = cleanString(req.query.sortBy, 20);
  const hasCoordinates = lat !== null && lng !== null;

  let shops = await User.searchShops({
    q,
    limit: hasCoordinates ? 500 : limit,
    minRating,
    requireLocation: hasCoordinates
  });

  if (hasCoordinates) {
    shops = shops.map(shop => {
      if (shop.latitude !== null && shop.longitude !== null) {
        return {
          ...shop,
          distance: distanceKm(lat, lng, Number(shop.latitude), Number(shop.longitude))
        };
      }

      return {
        ...shop,
        distance: null
      };
    });

    if (maxDistance !== null) {
      shops = shops.filter(shop => shop.distance !== null && shop.distance <= maxDistance);
    }

    if (sortBy === 'rating') {
      shops.sort((a, b) => (Number(b.avg_rating) || 0) - (Number(a.avg_rating) || 0) || (a.distance ?? Infinity) - (b.distance ?? Infinity));
    } else {
      shops.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity) || (Number(b.avg_rating) || 0) - (Number(a.avg_rating) || 0));
    }
  } else {
    if (sortBy === 'rating') {
      shops.sort((a, b) => (Number(b.avg_rating) || 0) - (Number(a.avg_rating) || 0) || String(a.name).localeCompare(String(b.name)));
    } else {
      shops.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }
  }

  shops = shops.slice(0, limit);

  return ok(res, 'Shops loaded', { shops });
}

async function nearbyShops(req, res) {
  const lat = toNumber(req.query.lat);
  const lng = toNumber(req.query.lng);

  if (lat === null || lng === null) {
    return fail(res, 400, 'Latitude and longitude are required');
  }

  const limit = Math.min(toPositiveInteger(req.query.limit, 20), 100);
  const maxDistance = toNumber(req.query.maxDistance ?? req.query.radius) ?? 10;
  const minRating = toNumber(req.query.minRating);

  const shops = await User.searchShops({
    q: '',
    limit: 500,
    minRating,
    requireLocation: true
  });

  const nearby = shops
    .map(shop => ({
      ...shop,
      distance: distanceKm(lat, lng, Number(shop.latitude), Number(shop.longitude))
    }))
    .filter(shop => shop.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance || (Number(b.avg_rating) || 0) - (Number(a.avg_rating) || 0))
    .slice(0, limit);

  return ok(res, 'Nearby shops loaded', { shops: nearby });
}

module.exports = {
  updateLocation,
  searchShops,
  nearbyShops
};

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
