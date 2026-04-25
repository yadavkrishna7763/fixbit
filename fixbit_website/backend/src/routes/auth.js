const express = require('express');
const controller = require('../controllers/authController');
const { asyncHandler } = require('../utils/apiResponse');

const router = express.Router();

router.post('/register', asyncHandler(controller.register));
router.post('/login', asyncHandler(controller.login));
router.post('/social-login', asyncHandler(controller.socialLogin));

module.exports = router;
