const express = require('express');
const router = express.Router();
const partnerController = require('../controllers/partnerController');
const { auth, authorize } = require('../middleware/auth');

// Role 5 is dedicated to Partners
const ROLE_PARTNER = 5;

// Public Partner Routes
router.post('/signup', partnerController.registerPartner);

// Private Partner Routes (Dashboard)
// Partners have Role 5
router.get('/profile', auth, authorize(ROLE_PARTNER), partnerController.getPartnerProfile);
router.patch('/profile', auth, authorize(ROLE_PARTNER), partnerController.updatePartnerProfile);
router.post('/add-client', auth, authorize(ROLE_PARTNER), partnerController.addPartnerClient);

// Admin Routes for Partners
router.get('/admin/list', auth, authorize('ADMIN'), partnerController.adminListPartners);
router.patch('/admin/:id', auth, authorize('ADMIN'), partnerController.adminUpdatePartner);

module.exports = router;
