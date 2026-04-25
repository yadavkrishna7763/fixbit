const express = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const controller = require('../controllers/requestController');
const { asyncHandler } = require('../utils/apiResponse');
const { requestUpload } = require('../utils/uploads');

const router = express.Router();

router.post('/', auth, requireRole('user'), requestUpload.single('image'), asyncHandler(controller.createRequest));
router.get('/nearby', auth, requireRole('shop'), asyncHandler(controller.getNearbyRequests));
router.get('/my', auth, requireRole('user'), asyncHandler(controller.getMyRequests));
router.get('/:id', auth, asyncHandler(controller.getRequest));
router.put('/:id/accept', auth, requireRole('user'), asyncHandler(controller.acceptQuote));
router.put('/:id/status', auth, requireRole('shop'), asyncHandler(controller.updateStatus));

module.exports = router;
