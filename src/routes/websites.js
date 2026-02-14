const express = require('express');
const router = express.Router();
const websiteController = require('../controllers/websiteController');
const { auth, authorize, checkModule } = require('../middleware/auth');

// Public route for landing pages (unauthenticated)
router.get('/public/:slugOrDomain', websiteController.getPublicWebsite);
router.post('/public/:id/leads', websiteController.captureLead);

// Protected routes
router.use(auth);

// Only Owners and Admins can manage websites
// Using marketing_hub or widget_creator as a proxy check for now, 
// but we can add 'website_builder' to the module list later.
const moduleCheck = checkModule('marketing_hub');

router.get('/', authorize('ADMIN', 'OWNER'), moduleCheck, websiteController.getWebsites);
router.post('/', authorize('ADMIN', 'OWNER'), moduleCheck, websiteController.createWebsite);
router.get('/:id', authorize('ADMIN', 'OWNER'), moduleCheck, websiteController.getWebsiteById);
router.put('/:id', authorize('ADMIN', 'OWNER'), moduleCheck, websiteController.updateWebsite);
router.delete('/:id', authorize('ADMIN', 'OWNER'), moduleCheck, websiteController.deleteWebsite);

module.exports = router;
