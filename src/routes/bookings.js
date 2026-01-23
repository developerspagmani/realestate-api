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
  getUserBookings
} = require('../controllers/bookingController');

const router = express.Router();

// Protected routes
router.use(auth);

// User booking routes
router.post('/', validate(schemas.createBooking), createBooking);
router.get('/my', getUserBookings); // This would need to be implemented in controller
router.get('/check-availability', checkAvailability);
router.get('/:id', getBookingById);
router.put('/:id/cancel', cancelBooking);

// Admin/Owner routes
// router.get('/', authorize('ADMIN', 'OWNER'), getAllBookings);
router.get('/', getAllBookings);
router.put('/:id', authorize(2, 3), validate(schemas.updateBooking), updateBooking);
router.put('/:id/status', authorize(2, 3), updateBookingStatus);
router.delete('/:id', authorize(2, 3), deleteBooking);
router.get('/stats', authorize(2, 3), getBookingStats);

module.exports = router;
