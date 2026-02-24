const express = require('express');
const router = express.Router();
const portalIntegrationController = require('../../controllers/social/portalIntegrationController');
const { auth, authorize } = require('../../middleware/auth');

// All portal routes require authentication
router.use(auth);

/**
 * @route GET /api/social/portals/listings
 * @desc Get status of listings on external portals
 */
router.get('/listings', portalIntegrationController.getListings);

/**
 * @route POST /api/social/portals/publish
 * @desc Publish a property to an external portal
 */
router.post('/publish', authorize(1, 2), portalIntegrationController.publish);

/**
 * @route POST /api/social/portals/sync-leads
 * @desc Manually trigger lead sync from external portal
 */
router.post('/sync-leads', authorize(1, 2), portalIntegrationController.syncLeads);

/**
 * @route POST /api/social/portals/credentials
 * @desc Update portal API/Login credentials
 */
router.post('/credentials', authorize(1, 2), portalIntegrationController.updateCredentials);

module.exports = router;
