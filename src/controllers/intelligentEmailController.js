const { prisma } = require('../config/database');

const getIntelligentConfig = async (req, res) => {
    try {
        const tenantId = req.tenant?.id;
        if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID required' });

        const module = await prisma.tenantModule.findFirst({
            where: { tenantId, module: { slug: 'marketing_hub' } }
        });

        const settings = module?.settings || {};
        const config = settings.intelligentEmail || {
            enabled: false,
            frequency: 'Weekly',
            budgetVariance: 15,
            includeUpsell: true,
            includeCrossSell: true,
            maxProperties: 4,
            aiPersonalization: true
        };

        res.status(200).json({ success: true, data: config });
    } catch (error) {
        console.error('Get Intelligent Config error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const saveIntelligentConfig = async (req, res) => {
    try {
        const tenantId = req.tenant?.id;
        const config = req.body;

        if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID required' });

        const module = await prisma.tenantModule.findFirst({
            where: { tenantId, module: { slug: 'marketing_hub' } }
        });

        if (!module) return res.status(404).json({ success: false, message: 'Marketing module not active' });

        const updatedSettings = {
            ...(module.settings || {}),
            intelligentEmail: config
        };

        await prisma.tenantModule.update({
            where: {
                tenantId_moduleId: {
                    tenantId: module.tenantId,
                    moduleId: module.moduleId
                }
            },
            data: { settings: updatedSettings }
        });

        res.status(200).json({ success: true, message: 'Configuration saved' });
    } catch (error) {
        console.error('Save Intelligent Config error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const getIntelligentLogs = async (req, res) => {
    try {
        const tenantId = req.tenant?.id;
        // In a real app, this would query a CampaignLog or LeadInteraction table
        // For now, return simulated logs based on recent interactions
        const logs = await prisma.leadInteraction.findMany({
            where: {
                tenantId,
                type: 'EMAIL_SENT',
                metadata: { path: ['type'], equals: 'recommendation' }
            },
            include: { lead: true },
            orderBy: { occurredAt: 'desc' },
            take: 20
        });

        res.status(200).json({ success: true, data: logs });
    } catch (error) {
        console.error('Get Intelligent Logs error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const testIntelligentEmail = async (req, res) => {
    try {
        const tenantId = req.tenant?.id;
        const { email, budget } = req.body;

        if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID required' });
        if (!email || !budget) return res.status(400).json({ success: false, message: 'Email and budget required' });

        const IntelligentEmailService = require('../services/marketing/IntelligentEmailService');

        // Custom generation for test
        const config = { budgetVariance: 15 }; // Use default for test

        // Mock a lead object for property service
        const mockLead = { id: 'test-lead', budget: Number(budget), email, name: 'Test User' };

        await IntelligentEmailService.generateAndSend(mockLead, tenantId, config);

        res.status(200).json({ success: true, message: 'Test email sent successfully' });
    } catch (error) {
        console.error('Test Intelligent Email error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const getIntelligentStats = async (req, res) => {
    try {
        const tenantId = req.tenant?.id;
        if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID required' });

        const sentCount = await prisma.leadInteraction.count({
            where: { tenantId, type: 'EMAIL_SENT', metadata: { path: ['type'], equals: 'recommendation' } }
        });

        const openCount = await prisma.leadInteraction.count({
            where: { tenantId, type: 'EMAIL_OPEN', metadata: { path: ['type'], equals: 'recommendation' } }
        });

        const clickCount = await prisma.leadInteraction.count({
            where: { tenantId, type: 'EMAIL_CLICK', metadata: { path: ['type'], equals: 'recommendation' } }
        });

        // Simulating some ROI metrics based on lead scores/status of those who interacted
        const convertedLeads = await prisma.lead.count({
            where: { tenantId, status: 2, interactions: { some: { type: 'EMAIL_CLICK', metadata: { path: ['type'], equals: 'recommendation' } } } }
        });

        res.status(200).json({
            success: true,
            data: {
                totalSent: sentCount || 0,
                openRate: sentCount > 0 ? ((openCount / sentCount) * 100).toFixed(1) : 0,
                clickRate: sentCount > 0 ? ((clickCount / sentCount) * 100).toFixed(1) : 0,
                convertedLeads: convertedLeads || 0,
                estimatedRevenue: (convertedLeads * 15000) // Placeholder logic
            }
        });
    } catch (error) {
        console.error('Get Stats error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const getLeadSegments = async (req, res) => {
    try {
        const tenantId = req.tenant?.id;
        if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID required' });

        const leads = await prisma.lead.findMany({
            where: { tenantId, status: 1 },
            select: { budget: true, id: true, interactions: { where: { type: 'EMAIL_SENT' } } }
        });

        const segments = [
            { name: 'Starter (< 100k)', min: 0, max: 100000, count: 0, automated: 0 },
            { name: 'Mid-Range (100k - 500k)', min: 100000, max: 500000, count: 0, automated: 0 },
            { name: 'Premium (500k - 1M)', min: 500000, max: 1000000, count: 0, automated: 0 },
            { name: 'Luxury (1M+)', min: 1000000, max: 999999999, count: 0, automated: 0 },
        ];

        leads.forEach(l => {
            const b = Number(l.budget);
            const segment = segments.find(s => b >= s.min && b < s.max);
            if (segment) {
                segment.count++;
                if (l.interactions.length > 0) segment.automated++;
            }
        });

        res.status(200).json({ success: true, data: segments });
    } catch (error) {
        console.error('Get Segments error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const getIntelligentHeatmap = async (req, res) => {
    try {
        const tenantId = req.tenant?.id;
        if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID required' });

        const interactions = await prisma.leadInteraction.findMany({
            where: {
                tenantId,
                type: { in: ['EMAIL_OPEN', 'EMAIL_CLICK'] },
                metadata: { path: ['type'], equals: 'recommendation' }
            },
            select: { occurredAt: true }
        });

        // 7 days x 24 hours
        const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));

        interactions.forEach(i => {
            const date = new Date(i.occurredAt);
            const day = date.getDay();
            const hour = date.getHours();
            heatmap[day][hour]++;
        });

        res.status(200).json({ success: true, data: heatmap });
    } catch (error) {
        console.error('Get Heatmap error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = {
    getIntelligentConfig,
    saveIntelligentConfig,
    getIntelligentLogs,
    getIntelligentStats,
    getLeadSegments,
    getIntelligentHeatmap,
    testIntelligentEmail
};
