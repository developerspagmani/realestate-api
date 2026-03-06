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
  extendTrial,
  setTenantExpiry,
  revokeKey,
  getTenantSubscriptionDetail
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
router.get('/dashboard', auth, authorize(2, 3), getDashboardStats);

// Settings (Admin only)
router.get('/settings', auth, authorize(2), getSystemSettings);
router.post('/settings', auth, authorize(2), updateSystemSetting);

// Trial Extension (Admin only)
router.post('/tenants/extend-trial', auth, authorize(2), extendTrial);
// Set explicit expiry date (Admin only)
router.post('/tenants/set-expiry', auth, authorize(2), setTenantExpiry);
// Revoke license key from tenant (Admin only)
router.post('/tenants/revoke-key', auth, authorize(2), revokeKey);
// Get full subscription detail for a tenant (Admin only)
router.get('/tenants/:tenantId/subscription', auth, authorize(2), getTenantSubscriptionDetail);
// Admin assign license key to tenant
const { adminAssignKey } = require('../controllers/licenseKeyController');
router.post('/license-keys/assign', auth, authorize(2), adminAssignKey);

// User management (Admin only)
router.get('/users', auth, authorize(2), getUsers);
router.get('/users/:id', auth, authorize(2), getUser);
router.post('/users', auth, authorize(2), validate(schemas.createUser), createUser);
router.put('/users/:id', auth, authorize(2), validate(schemas.updateUser), updateUser);
router.delete('/users/:id', auth, authorize(2), deleteUser);

// Property owner management (Admin can see all owners)
router.get('/owners', auth, authorize(2), (req, res, next) => {
  req.query.role = '3';
  getUsers(req, res, next);
});

// Owner specific management (Admin only)
router.get('/owners/:id/stats', auth, authorize(2), getOwnerStats);
router.get('/owners/:id/properties', auth, authorize(2), getOwnerProperties);
router.get('/owners/:id/units', auth, authorize(2), getOwnerUnits);
router.get('/owners/:id/bookings', auth, authorize(2), getOwnerBookings);
router.get('/owners/:id/users', auth, authorize(2), getOwnerUsers);

// Property management
router.get('/properties', auth, authorize(2, 3), getAllProperties);

// Space management
router.get('/workspace', auth, authorize(2, 3), getAllSpaces);
router.post('/workspace', auth, authorize(2, 3), validate(schemas.createSpace), createSpace);

// Analytics
router.get('/analytics', auth, authorize(2, 3), getSystemAnalytics);

// Advanced Analytics
const analyticsController = require('../controllers/analyticsController');
const dealIntelligenceController = require('../controllers/dealIntelligenceController');
const propIntelController = require('../controllers/propIntelController');

router.get('/analytics-pro/revenue-funnel', auth, authorize(2, 3), analyticsController.getRevenueAndLeads);
router.get('/analytics-pro/agent-performance', auth, authorize(2, 3), analyticsController.getAgentPerformance);
router.get('/analytics-pro/campaign-stats', auth, authorize(2, 3), analyticsController.getCampaignPerformance);
router.get('/analytics-pro/marketing-insights', auth, authorize(2, 3), analyticsController.getMarketingInsights);
router.get('/analytics-pro/demand-intelligence', auth, authorize(2, 3), analyticsController.getDemandIntelligence);
router.get('/analytics-pro/deal-intelligence', auth, authorize(2, 3), dealIntelligenceController.getLostDealsIntelligence);
router.get('/analytics-pro/prevention-insights', auth, authorize(2, 3), dealIntelligenceController.getPreventionInsights);

// PropIntel AI endpoints
router.get('/prop-intel/diagnostics', auth, authorize(2, 3), propIntelController.getDiagnostics);
router.get('/prop-intel/pmf-analysis', auth, authorize(2, 3), propIntelController.getPMFAnalysis);
router.get('/prop-intel/suggestions', auth, authorize(2, 3), propIntelController.getSuggestions);

module.exports = router;
