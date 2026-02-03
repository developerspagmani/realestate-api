const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

/**
 * @swagger
 * tags:
 *   name: Public
 *   description: Unauthenticated discovery endpoints for widgets and public pages
 */

const { getFormPublic } = require('../controllers/formBuilderController');
const { trackInteraction } = require('../controllers/interactionController');
const { trackOpen, trackClick } = require('../controllers/publicTrackingController');

// Property listing (unauthenticated)
router.get('/properties', publicController.getProperties);

// Property detail (unauthenticated)
router.get('/properties/:id', publicController.getPropertyDetail);

// Units listing (unauthenticated)
router.get('/units', publicController.getUnits);

// Unit detail (unauthenticated)
router.get('/units/:id', publicController.getUnitDetail);

// Managed Forms (unauthenticated)
router.get('/forms/:id', getFormPublic);

// Interaction Tracking (unauthenticated but requires lead/tenant identifiers)
router.post('/track', trackInteraction);

// Email Tracking (Public GET routes for pixels and redirects)
router.get('/track/open', trackOpen);
router.get('/track/click', trackClick);

module.exports = router;

