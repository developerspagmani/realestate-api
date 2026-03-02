const express = require('express');
const router = express.Router();
const cron = require('node-cron');
const ScheduledPostsService = require('../services/social/scheduledPostsService');

// Instantiate services
const scheduledPostsService = new ScheduledPostsService();

let isExecuting = false;

/**
 * Background Task Executor
 * This runs the same logic that the Vercel cron endpoint used to run.
 */
const executeCronTasks = async () => {
    if (isExecuting) {
        console.log('[Node-Cron] Skipping execution: Previous task still running.');
        return;
    }

    isExecuting = true;
    try {
        console.log('[Node-Cron] Starting background tasks execution...');

        // 1. Process Social Media Posts
        await scheduledPostsService.publishScheduledPosts();

        // 2. Process Marketing Workflows
        const WorkflowService = require('../services/marketing/WorkflowService');
        await WorkflowService.processWorkflows();

        // 3. Proactive Deal Prevention Scanning (Only every 15 mins to reduce DB load)
        const minute = new Date().getMinutes();
        if (minute % 15 === 0) {
            try {
                const dealPreventionService = require('../services/dealPreventionService');
                const leadNurtureService = require('../services/social/leadNurtureService');

                // Get all tenants to scan
                const { prisma } = require('../config/database');
                const tenants = await prisma.tenant.findMany({ select: { id: true } });

                for (const tenant of tenants) {
                    await dealPreventionService.scanTenantLeads(tenant.id);
                    await leadNurtureService.scanForRevivals(tenant.id);
                }
            } catch (riskError) {
                console.error('[Node-Cron] Risk scanning failed:', riskError);
            }
        } else {
            console.log(`[Node-Cron] Skipping risk scan (Next scan at minute ${Math.ceil((minute + 1) / 15) * 15 % 60})`);
        }

        console.log('[Node-Cron] Background tasks processed successfully.');
    } catch (error) {
        console.error('[Node-Cron] Error executing background tasks:', error);
    } finally {
        isExecuting = false;
    }
};

// Initialize Node-Cron (runs every minute as per previous Vercel config)
cron.schedule('* * * * *', executeCronTasks);
console.log('✅ Node-Cron initialized: Running every minute');

// Define cron route - Now INACTIVE
router.get('/process', async (req, res) => {
    try {
        /*
        // ORIGINAL LOGIC (KEEPING FOR LATER)
        const authHeader = req.headers.authorization || '';
        const cronSecret = process.env.CRON_SECRET;

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return res.status(401).json({ success: false, message: 'Unauthorized cron request' });
        }

        console.log('[Vercel Cron] Starting background tasks execution...');
        await executeCronTasks();
        */

        res.status(200).json({
            success: true,
            message: 'Cron API is currently inactive (switched to internal node-cron)',
            status: 'inactive'
        });
    } catch (error) {
        console.error('[Cron API] Error:', error);
        res.status(500).json({ success: false, message: 'Error in cron api', error: error.message });
    }
});

module.exports = router;
