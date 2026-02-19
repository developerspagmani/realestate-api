const express = require('express');
const router = express.Router();

// Import social route modules
const connectedAccountsRoutes = require('./connectedAccountsRoutes');
const scheduledPostsRoutes = require('./scheduledPostsRoutes');
const publishedPostsRoutes = require('./publishedPostsRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const whatsappRoutes = require('./whatsappRoutes');

// Mount routes
router.use('/accounts', connectedAccountsRoutes);
router.use('/posts/scheduled', scheduledPostsRoutes);
router.use('/posts/published', publishedPostsRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/whatsapp', whatsappRoutes);




// Health check for social module
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Social media module is running',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
