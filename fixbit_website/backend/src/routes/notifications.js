const express = require('express');
const auth = require('../middleware/auth');
const controller = require('../controllers/notificationController');
const { asyncHandler } = require('../utils/apiResponse');

const router = express.Router();

router.get('/my', auth, asyncHandler(controller.getMyNotifications));
router.put('/read-all', auth, asyncHandler(controller.markAllNotificationsRead));
router.put('/:id/read', auth, asyncHandler(controller.markNotificationRead));

module.exports = router;
