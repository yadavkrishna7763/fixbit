const express = require('express');
const auth = require('../middleware/auth');
const controller = require('../controllers/userController');
const { asyncHandler } = require('../utils/apiResponse');
const { profileUpload } = require('../utils/uploads');

const router = express.Router();

router.get('/profile', auth, asyncHandler(controller.getProfile));
router.put('/profile', auth, asyncHandler(controller.updateProfile));
router.post('/profile/image', auth, profileUpload.single('image'), asyncHandler(controller.uploadProfileImage));
router.post('/shop/images', auth, profileUpload.array('images', 5), asyncHandler(controller.uploadShopImages));
router.get('/shop/:shopId/images', asyncHandler(controller.getShopImages));

module.exports = router;
