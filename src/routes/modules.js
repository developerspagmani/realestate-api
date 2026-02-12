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
// Admin/Owner: Get modules for a specific tenant
router.get('/tenant/:tenantId', async (req, res) => {
    // Non-admin users can only view their own tenant's modules
    if (req.user.role !== 2 && req.user.tenantId !== req.params.tenantId) {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }
    return moduleController.getTenantModules(req, res);
});
router.post('/toggle', authorize('ADMIN'), moduleController.toggleTenantModule);

module.exports = router;
