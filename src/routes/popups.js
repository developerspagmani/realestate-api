const express = require('express');
const router = express.Router();
const popupController = require('../controllers/popupController');
const { auth, authorize, checkModule } = require('../middleware/auth');

// Public route to fetch popups for a website
router.get('/public/:websiteId', popupController.getPublicPopups);

// Protected routes
router.use(auth);

// Only Owners and Admins can manage popups
const moduleCheck = checkModule('website_cms');

router.get('/', authorize('ADMIN', 'OWNER'), moduleCheck, popupController.getPopups);
router.post('/', authorize('ADMIN', 'OWNER'), moduleCheck, popupController.createPopup);
router.get('/:id', authorize('ADMIN', 'OWNER'), moduleCheck, popupController.getPopupById);
router.get('/:id/submissions', authorize('ADMIN', 'OWNER'), moduleCheck, popupController.getPopupSubmissions);
router.put('/:id', authorize('ADMIN', 'OWNER'), moduleCheck, popupController.updatePopup);
router.delete('/:id', authorize('ADMIN', 'OWNER'), moduleCheck, popupController.deletePopup);

module.exports = router;
