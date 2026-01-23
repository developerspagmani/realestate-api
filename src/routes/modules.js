const express = require('express');
const router = express.Router();
const moduleController = require('../controllers/moduleController');
const { auth, authorize } = require('../middleware/auth');

router.use(auth);

// Public check for the current user's available modules
router.get('/my', moduleController.getMyModules);

// Admin-only module management
router.get('/all', authorize('ADMIN'), moduleController.getAllModules);
router.post('/', authorize('ADMIN'), moduleController.createModule);
router.get('/tenant/:tenantId', authorize('ADMIN'), moduleController.getTenantModules);
router.post('/toggle', authorize('ADMIN'), moduleController.toggleTenantModule);

module.exports = router;
