const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const {
    generateKeys,
    getAllKeys,
    validateKey,
    activateKey,
    adminAssignKey
} = require('../controllers/licenseKeyController');

const router = express.Router();

// Public route to validate key during registration
router.post('/validate', validateKey);

// User/Owner routes
router.post('/activate', auth, activateKey);

// Admin routes
router.get('/', auth, authorize('ADMIN'), getAllKeys);
router.post('/generate', auth, authorize('ADMIN'), generateKeys);
router.post('/assign', auth, authorize('ADMIN'), adminAssignKey);

module.exports = router;
