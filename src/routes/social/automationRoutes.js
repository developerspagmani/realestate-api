const express = require('express');
const router = express.Router();
const automationController = require('../../controllers/social/automationController');

router.get('/stats', automationController.getStats);
router.get('/workflows', automationController.getWorkflows);
router.get('/waiting-leads', automationController.getWaitingLeads);
router.get('/matched-leads', automationController.getMatchedLeads);

// CRUD
router.post('/workflows', automationController.createWorkflow);
router.put('/workflows/:id', automationController.updateWorkflow);
router.delete('/workflows/:id', automationController.deleteWorkflow);
router.post('/workflows/:id/toggle', automationController.toggleWorkflowStatus);

// AI Engine
router.post('/force-match', automationController.forceMatch);

module.exports = router;
