const express = require('express');
const { validate, schemas } = require('../middleware/validation');
const { auth, authorize } = require('../middleware/auth');
const {
  createBooking,
  getBookingById,
  updateBooking,
  updateBookingStatus,
  cancelBooking,
  deleteBooking,
  checkAvailability,
  getAllBookings,
  getBookingStats,
  getUserBookings,
  sendVisitInfo
} = require('../controllers/bookingController');

const router = express.Router();

// Protected routes
router.use(auth);

// User booking routes
router.post('/', validate(schemas.createBooking), createBooking);
router.get('/my', getUserBookings);
router.get('/check-availability', checkAvailability);

// FUNC-05 fix: Stats route BEFORE /:id so it's not shadowed
router.get('/stats', authorize(2, 3), getBookingStats);

// Admin/Owner routes — SEC-06 fix: restored authorization
router.get('/', authorize(2, 3), getAllBookings);

router.get('/:id', getBookingById);
router.put('/:id/cancel', cancelBooking);
router.put('/:id', authorize(2, 3), validate(schemas.updateBooking), updateBooking);
router.put('/:id/status', authorize(2, 3), updateBookingStatus);
router.put('/:id/send-info', authorize(2, 3), sendVisitInfo);
router.delete('/:id', authorize(2, 3), deleteBooking);

module.exports = router;
