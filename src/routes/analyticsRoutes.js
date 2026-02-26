const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');
const dealIntelligenceController = require('../controllers/dealIntelligenceController');

const router = express.Router();

// All analytics require authenticated access (Admins and Owners)
router.use(auth);
router.use(authorize(2, 3));

router.get('/revenue-funnel', analyticsController.getRevenueAndLeads);
router.get('/agent-performance', analyticsController.getAgentPerformance);
router.get('/campaign-stats', analyticsController.getCampaignPerformance);
router.get('/marketing-insights', analyticsController.getMarketingInsights);
router.get('/demand-intelligence', analyticsController.getDemandIntelligence);
router.get('/deal-intelligence', dealIntelligenceController.getLostDealsIntelligence);
router.get('/prevention-insights', dealIntelligenceController.getPreventionInsights);

module.exports = router;
