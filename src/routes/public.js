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

module.exports = router;

