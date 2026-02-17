const express = require('express');
const router = express.Router();
const integrationController = require('../controllers/integrationController');
const { auth, authorize } = require('../middleware/auth');

// Protected Routes (Admin/Owner UI)
router.get('/', auth, integrationController.getIntegrations);
router.post('/connect', auth, integrationController.connect);
router.patch('/:id/status', auth, integrationController.toggleStatus);
router.delete('/:id', auth, integrationController.deleteIntegration);

// Public Routes (Used by WP Plugin)
router.post('/verify', integrationController.verifyKey);

module.exports = router;
