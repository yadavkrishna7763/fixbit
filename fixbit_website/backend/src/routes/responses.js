const express = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const controller = require('../controllers/responseController');
const { asyncHandler } = require('../utils/apiResponse');

const router = express.Router();

router.post('/', auth, requireRole('shop'), asyncHandler(controller.sendQuote));
router.get('/request/:requestId', auth, asyncHandler(controller.getQuotesForRequest));
router.get('/shop', auth, requireRole('shop'), asyncHandler(controller.getShopQuotes));

module.exports = router;
