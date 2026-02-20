const express = require('express');
const router = express.Router();

// Import social route modules
const connectedAccountsRoutes = require('./connectedAccountsRoutes');
const scheduledPostsRoutes = require('./scheduledPostsRoutes');
const publishedPostsRoutes = require('./publishedPostsRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const whatsappRoutes = require('./whatsappRoutes');

const { auth } = require('../../middleware/auth');

// Mount routes
router.use('/accounts', auth, connectedAccountsRoutes);
router.use('/posts/scheduled', auth, scheduledPostsRoutes);
router.use('/posts/published', auth, publishedPostsRoutes);
router.use('/analytics', auth, analyticsRoutes);
router.use('/whatsapp', whatsappRoutes); // Auth handled within whatsappRoutes to exclude webhooks




// Health check for social module
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Social media module is running',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
