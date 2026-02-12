const express = require('express');
const { validate, schemas } = require('../middleware/validation');
const { auth, authorize } = require('../middleware/auth');
const {
  getDashboardStats,
  getAllSpaces,
  createSpace,
  getSystemAnalytics,
  getAllProperties,
  getSystemSettings,
  updateSystemSetting,
  extendTrial
} = require('../controllers/adminController');

const {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getOwnerStats,
  getOwnerProperties,
  getOwnerUnits,
  getOwnerBookings,
  getOwnerUsers,
  getUser
} = require('../controllers/userController');

const router = express.Router();

// Dashboard (Admin and Owners)
router.get('/dashboard', auth, getDashboardStats);

// Settings (Admin only)
router.get('/settings', auth, authorize('ADMIN'), getSystemSettings);
router.post('/settings', auth, authorize('ADMIN'), updateSystemSetting);

// Trial Extension (Admin only)
router.post('/tenants/extend-trial', auth, authorize('ADMIN'), extendTrial);

// User management
router.get('/users', getUsers);
router.get('/users/:id', getUser);
router.post('/users', validate(schemas.createUser), createUser);
router.put('/users/:id', validate(schemas.updateUser), updateUser);
router.delete('/users/:id', deleteUser);

// Property owner management (Admin can see all owners)
router.get('/owners', (req, res, next) => {
  req.query.role = '3';
  getUsers(req, res, next);
});

// Owner specific management
router.get('/owners/:id/stats', getOwnerStats);
router.get('/owners/:id/properties', getOwnerProperties);
router.get('/owners/:id/units', getOwnerUnits);
router.get('/owners/:id/bookings', getOwnerBookings);
router.get('/owners/:id/users', getOwnerUsers);

// Property management
router.get('/properties', getAllProperties);

// Space management
router.get('/workspace', getAllSpaces);
router.post('/workspace', validate(schemas.createSpace), createSpace);

// Analytics
router.get('/analytics', getSystemAnalytics);

module.exports = router;
