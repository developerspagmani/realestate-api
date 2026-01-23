const express = require('express');
const { validate, schemas } = require('../middleware/validation');
const { auth, authorize } = require('../middleware/auth');
const {
  processPayment,
  getPaymentById,
  getUserPayments,
  getAllPayments,
  processRefund,
  getPaymentStats,
} = require('../controllers/paymentController');

const router = express.Router();

// Protected routes
router.use(auth);

// User payment routes
router.post('/', validate(schemas.processPayment), processPayment);
router.get('/my', getUserPayments);
router.get('/:id', getPaymentById);

// Admin/Owner routes
router.get('/', authorize('ADMIN', 'OWNER'), getAllPayments);
router.post('/:id/refund', authorize('ADMIN', 'OWNER'), processRefund);
router.get('/stats', authorize('ADMIN', 'OWNER'), getPaymentStats);

module.exports = router;
