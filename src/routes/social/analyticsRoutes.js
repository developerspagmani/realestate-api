const express = require('express');
const router = express.Router();
const analyticsController = require('../../controllers/social/analyticsController');

// Get analytics overview
router.get('/overview', analyticsController.getOverview);

// Get platform-specific analytics
router.get('/platforms', analyticsController.getPlatformAnalytics);

// Get posting trends
router.get('/trends', analyticsController.getPostingTrends);

// Get property analytics
router.get('/properties', analyticsController.getPropertyAnalytics);

// Get engagement metrics
router.get('/engagement', analyticsController.getEngagementMetrics);

module.exports = router;
