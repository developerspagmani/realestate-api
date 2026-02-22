const { prisma } = require('../../config/database');

const automationController = {
    /**
     * Get Automation Hub Stats
     */
    getStats: async (req, res) => {
        try {
            const isSuperAdmin = req.user?.role === 4;
            const tenantId = req.tenant?.id || req.user?.tenantId;

            const where = {};
            if (!isSuperAdmin) {
                if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID required' });
                where.tenantId = tenantId;
            }

            // 1. Waiting leads
            const activeLeads = await prisma.lead.count({
                where: {
                    ...where,
                    preferences: {
                        path: ['isWaitingForMatch'],
                        equals: true
                    }
                }
            });

            // 2. Total matches found
            const matchesFound = await prisma.leadInteraction.count({
                where: {
                    ...where,
                    type: 'PROPERTY_MATCH'
                }
            });

            // 3. Notifications sent
            const notificationsSent = await prisma.leadInteraction.count({
                where: {
                    ...where,
                    type: 'PROPERTY_MATCH'
                }
            });

            res.json({
                success: true,
                data: {
                    activeLeads,
                    matchesFound,
                    notificationsSent,
                    successRate: '85%' // Hardcoded for now until conversion logic is unified
                }
            });
        } catch (error) {
            console.error('[AutomationController] Stats error:', error);
            res.status(500).json({ success: false, message: 'Error fetching automation stats' });
        }
    },

    /**
     * Get Active Workflows (Nurture flows)
     */
    getWorkflows: async (req, res) => {
        try {
            const isSuperAdmin = req.user?.role === 4;
            const tenantId = req.tenant?.id || req.user?.tenantId;

            const where = {};
            if (!isSuperAdmin) {
                if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID required' });
                where.tenantId = tenantId;
            }

            const workflows = await prisma.marketingWorkflow.findMany({
                where,
                orderBy: { createdAt: 'desc' }
            });

            // Count enrollments for each workflow
            const workflowData = await Promise.all(workflows.map(async (wf) => {
                const count = await prisma.workflowLog.count({
                    where: { workflowId: wf.id }
                });

                let triggerInfo = 'Manual';
                try {
                    const triggerObj = typeof wf.trigger === 'string' ? JSON.parse(wf.trigger) : wf.trigger;
                    triggerInfo = triggerObj?.type?.replace('_', ' ') || 'Manual';
                } catch (e) { }

                return {
                    id: wf.id,
                    name: wf.name,
                    trigger: triggerInfo,
                    type: wf.type || 'WhatsApp',
                    sent: count,
                    status: wf.status === 1 ? 'Active' : 'Paused'
                };
            }));

            res.json({ success: true, data: workflowData });
        } catch (error) {
            console.error('[AutomationController] Workflows error:', error);
            res.status(500).json({ success: false, message: 'Error fetching workflows' });
        }
    },

    /**
     * Get Waiting Leads (Matching Engine)
     */
    getWaitingLeads: async (req, res) => {
        try {
            const isSuperAdmin = req.user?.role === 4; // Assuming 4 is SUPER_ADMIN
            const tenantId = req.tenant?.id || req.user?.tenantId;

            const where = {};
            if (!isSuperAdmin) {
                if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID required' });
                where.tenantId = tenantId;
            }

            where.preferences = {
                path: ['isWaitingForMatch'],
                equals: true
            };

            const leads = await prisma.lead.findMany({
                where,
                include: {
                    tenant: {
                        select: { name: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            const transformedLeads = leads.map(l => {
                const prefs = l.preferences || {};
                return {
                    id: l.id,
                    name: l.name || 'Anonymous',
                    tenant: l.tenant?.name || 'Unknown',
                    location: prefs.location || 'Anywhere',
                    budget: prefs.maxPrice ? `₹${prefs.maxPrice.toLocaleString()}` : 'Not Set',
                    type: prefs.propertyType || 'Generic',
                    date: l.createdAt.toISOString().split('T')[0]
                };
            });

            res.json({ success: true, data: transformedLeads });
        } catch (error) {
            console.error('[AutomationController] Waiting leads error:', error);
            res.status(500).json({ success: false, message: 'Error fetching waiting leads' });
        }
    }
};

module.exports = automationController;
