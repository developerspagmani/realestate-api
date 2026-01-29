const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const {
    getAllAudienceGroups,
    createAudienceGroup,
    updateAudienceGroup,
    deleteAudienceGroup
} = require('../controllers/audienceController');
const {
    getAllTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate
} = require('../controllers/templateController');
const {
    getAllWorkflows,
    createWorkflow,
    updateWorkflow,
    toggleWorkflow,
    deleteWorkflow
} = require('../controllers/workflowController');
const {
    getAllForms,
    createForm,
    updateForm,
    deleteForm
} = require('../controllers/formBuilderController');
const { getCampaignStats } = require('../controllers/campaignController');

const router = express.Router();

// All routes are protected and require admin/owner access
router.use(auth);
router.use(authorize(2, 3));

// Audience Routes
router.get('/audience', getAllAudienceGroups);
router.post('/audience', createAudienceGroup);
router.put('/audience/:id', updateAudienceGroup);
router.delete('/audience/:id', deleteAudienceGroup);

// Template Routes
router.get('/templates', getAllTemplates);
router.post('/templates', createTemplate);
router.put('/templates/:id', updateTemplate);
router.delete('/templates/:id', deleteTemplate);

// Workflow Routes
router.get('/workflows', getAllWorkflows);
router.post('/workflows', createWorkflow);
router.put('/workflows/:id', updateWorkflow);
router.put('/workflows/:id/toggle', toggleWorkflow);
router.delete('/workflows/:id', deleteWorkflow);

// Form Builder Routes
router.get('/forms', getAllForms);
router.post('/forms', createForm);
router.put('/forms/:id', updateForm);
router.delete('/forms/:id', deleteForm);

// Stats Routes
router.get('/stats', getCampaignStats);

module.exports = router;
