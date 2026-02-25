const express = require('express');
const router = express.Router();
const ScheduledPostsService = require('../services/social/scheduledPostsService');

// Instantiate services
const scheduledPostsService = new ScheduledPostsService();

// Define cron route
router.get('/process', async (req, res) => {
    try {
        // Vercel Cron sends a Bearer token in the Authorization header.
        // It's recommended to verify this header against a CRON_SECRET environment variable.
        const authHeader = req.headers.authorization || '';
        const cronSecret = process.env.CRON_SECRET;

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return res.status(401).json({ success: false, message: 'Unauthorized cron request' });
        }

        console.log('[Vercel Cron] Starting background tasks execution...');

        // 1. Process Social Media Posts
        await scheduledPostsService.publishScheduledPosts();

        // 2. Process Marketing Workflows
        const WorkflowService = require('../services/marketing/WorkflowService');
        await WorkflowService.processWorkflows();

        console.log('[Vercel Cron] Background tasks processed successfully.');

        // Always return 200 OK to acknowledge the cron execution
        res.status(200).json({ success: true, message: 'Cron tasks executed successfully' });
    } catch (error) {
        console.error('[Vercel Cron] Error executing background tasks:', error);
        res.status(500).json({ success: false, message: 'Error executing cron tasks', error: error.message });
    }
});

module.exports = router;
