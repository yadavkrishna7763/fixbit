const Request = require('../models/requestModel');
const Review = require('../models/reviewModel');
const { ok, fail } = require('../utils/apiResponse');
const { cleanString, toPositiveInteger } = require('../utils/validation');

async function submitReview(req, res) {
  const requestId = Number(req.body.request_id);
  const rating = toPositiveInteger(req.body.rating);
  const comment = cleanString(req.body.comment, 1000);

  if (!Number.isInteger(requestId) || requestId <= 0 || !rating || rating < 1 || rating > 5) {
    return fail(res, 400, 'Invalid review data');
  }

  const request = await Request.findById(requestId);
  if (!request || Number(request.user_id) !== Number(req.user.id)) {
    return fail(res, 404, 'Request not found');
  }

  if (request.status !== 'completed' || !request.accepted_shop_id) {
    return fail(res, 400, 'You can review a shop after the repair is completed');
  }

  const shopId = Number(request.accepted_shop_id);
  await Review.upsertReview({
    requestId,
    userId: req.user.id,
    shopId,
    rating,
    comment
  });
  await Review.updateShopAverage(shopId);

  return ok(res, 'Review submitted');
}

async function getShopReviews(req, res) {
  const shopId = Number(req.params.shopId);
  if (!Number.isInteger(shopId) || shopId <= 0) {
    return fail(res, 400, 'Invalid shop id');
  }

  const reviews = await Review.listForShop(shopId);
  return ok(res, 'Reviews loaded', { reviews });
}

module.exports = {
  submitReview,
  getShopReviews
};
