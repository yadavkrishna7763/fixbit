const express = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const controller = require('../controllers/reviewController');
const { asyncHandler } = require('../utils/apiResponse');

const router = express.Router();

router.post('/', auth, requireRole('user'), asyncHandler(controller.submitReview));
router.get('/shop/:shopId', asyncHandler(controller.getShopReviews));

module.exports = router;
