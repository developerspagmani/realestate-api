const express = require('express');
const router = express.Router();
const automationController = require('../../controllers/social/automationController');

router.get('/stats', automationController.getStats);
router.get('/workflows', automationController.getWorkflows);
router.get('/waiting-leads', automationController.getWaitingLeads);

module.exports = router;
