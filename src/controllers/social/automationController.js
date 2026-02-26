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
                const count = await prisma.workflowEnrollment.count({
                    where: { workflowId: wf.id }
                });

                let triggerInfo = 'Manual';
                let channelInfo = 'WhatsApp';
                try {
                    const triggerObj = typeof wf.trigger === 'string' ? JSON.parse(wf.trigger) : wf.trigger;
                    triggerInfo = triggerObj?.type?.replace('_', ' ') || 'Manual';
                    channelInfo = triggerObj?.channel || 'WhatsApp';
                } catch (e) { }

                return {
                    id: wf.id,
                    name: wf.name,
                    trigger: triggerInfo,
                    type: channelInfo,
                    sent: count,
                    status: wf.status === 1 ? 'Active' : 'Paused'
                };
            }));

            res.json({ success: true, data: workflowData });
        } catch (error) {
            console.error('[AutomationController] Workflows error:', error);
            res.status(500).json({ success: false, message: 'Error fetching workflows', details: error.message });
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
            res.status(500).json({ success: false, message: 'Error fetching waiting leads', details: error.message });
        }
    },

    /**
     * Get Matched Leads
     */
    getMatchedLeads: async (req, res) => {
        try {
            const isSuperAdmin = req.user?.role === 4;
            const tenantId = req.tenant?.id || req.user?.tenantId;

            const where = {};
            if (!isSuperAdmin) {
                if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID required' });
                where.tenantId = tenantId;
            }

            // A matched lead is someone who has `isWaitingForMatch: false` AND they had a `PROPERTY_MATCH` interaction.
            const interactions = await prisma.leadInteraction.findMany({
                where: {
                    tenantId: where.tenantId,
                    type: 'PROPERTY_MATCH'
                },
                select: { leadId: true },
                distinct: ['leadId']
            });
            const leadIds = interactions.map(i => i.leadId);

            const leads = await prisma.lead.findMany({
                where: {
                    ...where,
                    id: { in: leadIds }
                },
                include: {
                    tenant: { select: { name: true } },
                    interactions: {
                        where: { type: 'PROPERTY_MATCH' },
                        orderBy: { occurredAt: 'desc' },
                        take: 1
                    }
                },
                orderBy: { updatedAt: 'desc' }
            });

            const transformedLeads = leads.map(l => {
                const prefs = l.preferences || {};
                const lastMatch = l.interactions[0];
                return {
                    id: l.id,
                    name: l.name || 'Anonymous',
                    tenant: l.tenant?.name || 'Unknown',
                    location: prefs.location || 'Anywhere',
                    budget: prefs.maxPrice ? `₹${prefs.maxPrice.toLocaleString()}` : (l.budget ? `₹${l.budget.toLocaleString()}` : 'Not Set'),
                    type: prefs.propertyType || 'Generic',
                    matchedDate: lastMatch ? lastMatch.occurredAt.toISOString().split('T')[0] : l.updatedAt.toISOString().split('T')[0],
                    matchCount: lastMatch?.metadata?.propertyIds?.length || 0,
                    status: 'Matched'
                };
            });

            res.json({ success: true, data: transformedLeads });
        } catch (error) {
            console.error('[AutomationController] Matched leads error:', error);
            res.status(500).json({ success: false, message: 'Error fetching matched leads', details: error.message });
        }
    },

    /**
     * Create Workflow
     */
    createWorkflow: async (req, res) => {
        try {
            const tenantId = req.body.tenantId || req.user?.tenantId;
            if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID required' });

            const { name, trigger, channel, description, type } = req.body;
            const actualChannel = channel || type;

            const workflow = await prisma.marketingWorkflow.create({
                data: {
                    tenantId,
                    name,
                    description,
                    trigger: { type: trigger, channel: actualChannel },
                    steps: [], // Default empty steps for matching engine
                    status: 1, // Active
                }
            });

            res.json({ success: true, data: workflow });
        } catch (error) {
            console.error('[AutomationController] Create error:', error);
            res.status(500).json({ success: false, message: 'Error creating workflow', details: error.message });
        }
    },

    /**
     * Update Workflow
     */
    updateWorkflow: async (req, res) => {
        try {
            const { id } = req.params;
            const { name, trigger, status, channel, description, type } = req.body;
            const actualChannel = channel || type;

            const workflow = await prisma.marketingWorkflow.update({
                where: { id },
                data: {
                    name,
                    description,
                    trigger: trigger ? { type: trigger, channel: actualChannel } : undefined,
                    ...(status && { status: status === 'Active' || status === 1 ? 1 : 2 })
                }
            });

            res.json({ success: true, data: workflow });
        } catch (error) {
            console.error('[AutomationController] Update error:', error);
            res.status(500).json({ success: false, message: 'Error updating workflow', details: error.message });
        }
    },

    /**
     * Delete Workflow
     */
    deleteWorkflow: async (req, res) => {
        try {
            const { id } = req.params;
            await prisma.marketingWorkflow.delete({ where: { id } });
            res.json({ success: true, message: 'Workflow deleted' });
        } catch (error) {
            console.error('[AutomationController] Delete error:', error);
            res.status(500).json({ success: false, message: 'Error deleting workflow', details: error.message });
        }
    },

    /**
     * Toggle Workflow status
     */
    toggleWorkflowStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const workflow = await prisma.marketingWorkflow.findUnique({ where: { id } });
            if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });

            const updated = await prisma.marketingWorkflow.update({
                where: { id },
                data: { status: workflow.status === 1 ? 2 : 1 }
            });

            res.json({ success: true, data: updated });
        } catch (error) {
            console.error('[AutomationController] Toggle error:', error);
            res.status(500).json({ success: false, message: 'Error toggling workflow', details: error.message });
        }
    },

    /**
     * Force Match Engine
     */
    forceMatch: async (req, res) => {
        try {
            const { leadId, tenantId: bodyTenantId } = req.body;
            const tenantId = bodyTenantId || req.user?.tenantId;

            if (!leadId) return res.status(400).json({ success: false, message: 'Lead ID required' });

            const lead = await prisma.lead.findUnique({
                where: { id: leadId },
                include: { tenant: true }
            });
            if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

            // Trigger real matching engine
            const leadNurtureService = require('../../services/social/leadNurtureService');
            const propertyService = require('../../services/social/propertyService');

            // Temporary: ensure lead is in waiting state for the engine to pick it up
            if (!lead.preferences?.isWaitingForMatch) {
                await prisma.lead.update({
                    where: { id: lead.id },
                    data: {
                        preferences: {
                            ...(lead.preferences || {}),
                            isWaitingForMatch: true
                        }
                    }
                });
            }

            const filters = lead.preferences || {};
            const properties = await propertyService.searchProperties(filters, lead.tenantId);
            const matchCount = properties.length;

            if (matchCount > 0) {
                await leadNurtureService.notifyLeadOfMatches(lead, properties);

                // Update lead status
                await prisma.lead.update({
                    where: { id: lead.id },
                    data: {
                        status: 2, // Contacted
                        preferences: {
                            ...(lead.preferences || {}),
                            isWaitingForMatch: false
                        }
                    }
                });
            }

            res.json({
                success: true,
                data: {
                    matchCount,
                    channel: 'WhatsApp',
                    status: matchCount > 0 ? 'Dispatched' : 'Checking'
                }
            });
        } catch (error) {
            console.error('[AutomationController] Force match error:', error);
            res.status(500).json({ success: false, message: 'Error executing matching engine', details: error.message });
        }
    }
};

module.exports = automationController;
