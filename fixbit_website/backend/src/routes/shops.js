const express = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const controller = require('../controllers/shopController');
const { asyncHandler } = require('../utils/apiResponse');

const router = express.Router();

router.put('/location', auth, requireRole('shop'), asyncHandler(controller.updateLocation));
router.get('/nearby', asyncHandler(controller.nearbyShops));
router.get('/search', asyncHandler(controller.searchShops));

module.exports = router;
