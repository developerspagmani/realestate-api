const express = require('express');
const router = express.Router();

// Import social route modules
const connectedAccountsRoutes = require('./connectedAccountsRoutes');
const scheduledPostsRoutes = require('./scheduledPostsRoutes');
const publishedPostsRoutes = require('./publishedPostsRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const whatsappRoutes = require('./whatsappRoutes');
const automationRoutes = require('./automationRoutes');
const portalRoutes = require('./portalRoutes');

const { auth } = require('../../middleware/auth');

// Mount routes
router.use('/accounts', auth, connectedAccountsRoutes);
router.use('/posts/scheduled', auth, scheduledPostsRoutes);
router.use('/posts/published', auth, publishedPostsRoutes);
router.use('/analytics', auth, analyticsRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/automation', auth, automationRoutes);
router.use('/portals', auth, portalRoutes);




// Health check for social module
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Social media module is running',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
