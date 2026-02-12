const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const {
    generateKeys,
    getAllKeys,
    validateKey,
    activateKey
} = require('../controllers/licenseKeyController');

const router = express.Router();

// Public route to validate key during registration
router.post('/validate', validateKey);

// User/Owner routes
router.post('/activate', auth, activateKey);

// Admin routes
router.get('/', auth, authorize('ADMIN'), getAllKeys);
router.post('/generate', auth, authorize('ADMIN'), generateKeys);

module.exports = router;
