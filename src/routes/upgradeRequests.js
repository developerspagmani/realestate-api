const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const upgradeRequestController = require('../controllers/upgradeRequestController');

const router = express.Router();

router.use(auth);

// Owner: Submit request
router.post('/', upgradeRequestController.submitRequest);

// Admin: Get all requests
router.get('/', authorize('ADMIN'), upgradeRequestController.getAllRequests);

// Admin: Update status
router.put('/:id/status', authorize('ADMIN'), upgradeRequestController.updateRequestStatus);

module.exports = router;
