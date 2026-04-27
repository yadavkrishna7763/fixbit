const Request = require('../models/requestModel');
const Response = require('../models/responseModel');
const { ok, fail } = require('../utils/apiResponse');
const { getIO } = require('../socket');
const { cleanString, toPositiveNumber } = require('../utils/validation');

async function sendQuote(req, res) {
  const requestId = Number(req.body.request_id);
  const price = toPositiveNumber(req.body.price);
  const message = cleanString(req.body.message, 1000);

  if (!Number.isInteger(requestId) || requestId <= 0 || !price) {
    return fail(res, 400, 'Request ID and a valid price are required');
  }

  const request = await Request.findById(requestId);
  if (!request) {
    return fail(res, 404, 'Request not found');
  }

  if (Number(request.user_id) === Number(req.user.id)) {
    return fail(res, 403, 'You cannot quote your own request');
  }

  if (request.status !== 'pending') {
    return fail(res, 409, 'This request is no longer accepting quotes');
  }

  await Response.upsertQuote({
    requestId,
    shopId: req.user.id,
    price,
    message
  });

  try {
    getIO().to(`user_${request.user_id}`).emit('new_quote_received', { requestId, shopId: req.user.id, price });
  } catch (e) {
    console.error('Socket error emitting new_quote_received', e);
  }

  return ok(res, 'Quote sent');
}

async function getQuotesForRequest(req, res) {
  const requestId = Number(req.params.requestId);
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

  const responses = await Response.listForRequest(requestId);
  return ok(res, 'Quotes loaded', { responses });
}

async function getShopQuotes(req, res) {
  const quotes = await Response.listForShop(req.user.id);
  return ok(res, 'Shop quotes loaded', { quotes });
}

module.exports = {
  sendQuote,
  getQuotesForRequest,
  getShopQuotes
};
