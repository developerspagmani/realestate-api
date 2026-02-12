const express = require('express');
const { auth, authorize, checkModule } = require('../middleware/auth');
const {
    getAllAudienceGroups,
    getAudienceGroupById,
    createAudienceGroup,
    updateAudienceGroup,
    deleteAudienceGroup
} = require('../controllers/audienceController');
const {
    getAllTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    sendTestEmail
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
const { trackInteraction, getLeadInteractions } = require('../controllers/interactionController');
const { runWorkflows, enrollInWorkflow, getEnrollments } = require('../controllers/workflowExecutionController');
const {
    getLeadRecommendations,
    sendRecommendationEmailDirectly
} = require('../controllers/recommendationController');

const router = express.Router();

// All routes are protected and require admin/owner access
router.use(auth);
router.use(authorize(2, 3));
router.use(checkModule('marketing_hub'));

// Audience Routes
router.get('/audience', getAllAudienceGroups);
router.get('/audience/:id', getAudienceGroupById);
router.post('/audience', createAudienceGroup);
router.put('/audience/:id', updateAudienceGroup);
router.delete('/audience/:id', deleteAudienceGroup);

// Template Routes
router.get('/templates', getAllTemplates);
router.post('/templates', createTemplate);
router.put('/templates/:id', updateTemplate);
router.delete('/templates/:id', deleteTemplate);
router.post('/templates/test', sendTestEmail);

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

// Interaction Tracking Routes
router.post('/track', trackInteraction);
router.get('/interactions/:id', getLeadInteractions);

// Workflow Execution Routes
router.post('/workflows/process', runWorkflows);
router.post('/workflows/enroll', enrollInWorkflow);
router.get('/workflows/:id/enrollments', getEnrollments);

// AI Recommendation Routes
router.get('/recommendations/:id', getLeadRecommendations);
router.post('/recommendations/:id/send', sendRecommendationEmailDirectly);

module.exports = router;
