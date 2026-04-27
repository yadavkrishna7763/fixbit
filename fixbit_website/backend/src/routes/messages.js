const express = require('express');
const auth = require('../middleware/auth');
const controller = require('../controllers/messageController');
const { asyncHandler } = require('../utils/apiResponse');

const router = express.Router();

router.post('/', auth, asyncHandler(controller.sendMessage));
router.get('/request/:requestId', auth, asyncHandler(controller.getMessages));
router.put('/read/:requestId', auth, asyncHandler(controller.markMessagesRead));

module.exports = router;
