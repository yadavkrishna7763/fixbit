const Request = require('../models/requestModel');
const User = require('../models/userModel');
const { ok, fail } = require('../utils/apiResponse');
const { getIO } = require('../socket');
const {
  cleanString,
  toNumber,
  toPositiveInteger
} = require('../utils/validation');

const ALLOWED_STATUS_UPDATES = new Set(['accepted', 'in_progress', 'completed', 'cancelled']);

async function createRequest(req, res) {
  const brand = cleanString(req.body.brand, 100);
  const model = cleanString(req.body.model, 100);
  const device_type = cleanString(req.body.device_type, 20);
  const issue_type = cleanString(req.body.issue_type, 100);
  const description = cleanString(req.body.description, 2000);
  const latitude = toNumber(req.body.latitude);
  const longitude = toNumber(req.body.longitude);
  const radius = toPositiveInteger(req.body.radius, 10);
  const image = req.file ? req.file.filename : null;

  if (!brand || !model || !device_type || !issue_type || !description) {
    return fail(res, 400, 'Device details and issue description are required');
  }

  if (latitude === null || longitude === null) {
    return fail(res, 400, 'Location is required to find nearby shops');
  }

  const requestId = await Request.createRequest({
    user_id: req.user.id,
    brand,
    model,
    device_type,
    issue_type,
    description,
    image,
    latitude,
    longitude,
    radius
  });

  try {
    getIO().emit('new_request_nearby', { requestId, brand, model, device_type });
  } catch (e) {
    console.error('Socket error emitting new_request_nearby', e);
  }

  return ok(res, 'Repair request created', { requestId }, 201);
}

async function getNearbyRequests(req, res) {
  let latitude = toNumber(req.query.lat);
  let longitude = toNumber(req.query.lng);

  if (latitude === null || longitude === null) {
    const shop = await User.findSafeById(req.user.id);
    latitude = toNumber(shop && shop.latitude);
    longitude = toNumber(shop && shop.longitude);
  }

  if (latitude === null || longitude === null) {
    return fail(res, 400, 'Latitude and longitude required');
  }

  const requests = await Request.listNearby({
    shopId: req.user.id,
    latitude,
    longitude
  });

  return ok(res, 'Nearby requests loaded', { requests });
}

async function getMyRequests(req, res) {
  const requests = await Request.listByUser(req.user.id);
  return ok(res, 'Requests loaded', { requests });
}

async function getRequest(req, res) {
  const requestId = Number(req.params.id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return fail(res, 400, 'Invalid request id');
  }

  const request = await Request.findById(requestId);
  if (!request) {
    return fail(res, 404, 'Request not found');
  }

  if (req.user.role === 'user' && Number(request.user_id) !== Number(req.user.id)) {
    return fail(res, 403, 'Access denied');
  }

  if (req.user.role === 'shop') {
    const isAcceptedShop = Number(request.accepted_shop_id) === Number(req.user.id);
    const hasQuoted = await Request.hasQuoteFromShop(requestId, req.user.id);
    if (!isAcceptedShop && !hasQuoted) {
      return fail(res, 403, 'Access denied');
    }
  }

  return ok(res, 'Request loaded', { request });
}

async function acceptQuote(req, res) {
  const requestId = Number(req.params.id);
  const shopId = Number(req.body.shop_id);

  if (!Number.isInteger(requestId) || requestId <= 0 || !Number.isInteger(shopId) || shopId <= 0) {
    return fail(res, 400, 'Valid request id and shop id are required');
  }

  const request = await Request.findById(requestId);
  if (!request || Number(request.user_id) !== Number(req.user.id)) {
    return fail(res, 404, 'Request not found');
  }

  if (request.status !== 'pending') {
    return fail(res, 409, 'A quote has already been accepted for this request');
  }

  const hasQuote = await Request.hasQuoteFromShop(requestId, shopId);
  if (!hasQuote) {
    return fail(res, 400, 'No quote from this shop');
  }

  await Request.acceptQuote(requestId, shopId);
  return ok(res, 'Quote accepted');
}

async function updateStatus(req, res) {
  const requestId = Number(req.params.id);
  const status = cleanString(req.body.status, 30);

  if (!Number.isInteger(requestId) || requestId <= 0) {
    return fail(res, 400, 'Invalid request id');
  }

  if (!ALLOWED_STATUS_UPDATES.has(status)) {
    return fail(res, 400, 'Invalid status');
  }

  const affectedRows = await Request.updateStatusForShop(requestId, req.user.id, status);
  if (!affectedRows) {
    return fail(res, 404, 'Request not found or not assigned to you');
  }

  if (status === 'completed') {
    try {
      await User.incrementCompletedJobs(req.user.id);
    } catch (e) {
      console.error('Error incrementing completed jobs', e);
    }
  }

  return ok(res, 'Status updated');
}

module.exports = {
  createRequest,
  getNearbyRequests,
  getMyRequests,
  getRequest,
  acceptQuote,
  updateStatus
};
