const express = require('express');
const router = express.Router();
const widgetController = require('../controllers/widgetController');
const { auth, authorize, checkModule } = require('../middleware/auth');

// Public route for widget rendering (unauthenticated)
router.get('/public/:uniqueId', widgetController.getPublicWidget);
router.post('/public/:uniqueId/leads', widgetController.captureLead);

// Protected routes
router.use(auth);

// Only Owners and Admins can manage widgets, and only if the module is enabled
const widgetCheck = checkModule('widget_creator');

router.get('/', authorize('ADMIN', 'OWNER'), widgetCheck, widgetController.getWidgets);
router.post('/', authorize('ADMIN', 'OWNER'), widgetCheck, widgetController.createWidget);
router.get('/:id', authorize('ADMIN', 'OWNER'), widgetCheck, widgetController.getWidgetById);
router.put('/:id', authorize('ADMIN', 'OWNER'), widgetCheck, widgetController.updateWidget);
router.delete('/:id', authorize('ADMIN', 'OWNER'), widgetCheck, widgetController.deleteWidget);

module.exports = router;
