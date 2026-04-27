const express = require('express');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const controller = require('../controllers/adminController');
const { asyncHandler } = require('../utils/apiResponse');

const router = express.Router();

router.get('/analytics', auth, asyncHandler(adminAuth), asyncHandler(controller.getAnalytics));
router.get('/users', auth, asyncHandler(adminAuth), asyncHandler(controller.getUsers));
router.put('/users/:id/ban', auth, asyncHandler(adminAuth), asyncHandler(controller.toggleBan));
router.get('/requests', auth, asyncHandler(adminAuth), asyncHandler(controller.getRequests));
router.delete('/requests/:id', auth, asyncHandler(adminAuth), asyncHandler(controller.deleteRequest));

module.exports = router;
