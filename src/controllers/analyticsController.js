const { prisma } = require('../config/database');

const analyticsController = {
    // 1. Revenue & Lead Funnel report
    getRevenueAndLeads: async (req, res) => {
        try {
            const { tenantId: queryTenantId } = req.query;
            const tenantId = queryTenantId || req.tenant?.id || req.user?.tenantId;

            if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID required' });

            // Revenue over time (last 6 months)
            const months = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                months.push({
                    name: d.toLocaleString('default', { month: 'short' }),
                    start: new Date(d.getFullYear(), d.getMonth(), 1),
                    end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
                });
            }

            const revenuePerMonth = await Promise.all(months.map(async (m) => {
                const result = await prisma.booking.aggregate({
                    where: {
                        tenantId,
                        status: { in: [2, 4] }, // Confirmed or Completed
                        createdAt: { gte: m.start, lte: m.end }
                    },
                    _sum: { totalPrice: true }
                });
                return {
                    month: m.name,
                    revenue: parseFloat(result._sum.totalPrice || 0)
                };
            }));

            // Lead Funnel
            const funnelLevels = [
                { status: 1, label: 'New Leads' },
                { status: 2, label: 'Contacted' },
                { status: 3, label: 'Qualified' },
                { status: 4, label: 'Converted' },
                { status: 5, label: 'Lost' }
            ];

            const funnelData = await Promise.all(funnelLevels.map(async (level) => {
                const count = await prisma.lead.count({
                    where: { tenantId, status: level.status }
                });
                return { label: level.label, count };
            }));

            res.json({
                success: true,
                data: {
                    revenueChart: revenuePerMonth,
                    funnel: funnelData
                }
            });
        } catch (error) {
            console.error('Revenue and leads error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    },

    // 2. Agent Efficiency
    getAgentPerformance: async (req, res) => {
        try {
            const { tenantId: queryTenantId } = req.query;
            const tenantId = queryTenantId || req.tenant?.id || req.user?.tenantId;

            const agents = await prisma.agent.findMany({
                where: { tenantId },
                include: {
                    user: { select: { name: true, email: true } },
                    _count: {
                        select: { bookings: true }
                    }
                }
            });

            const performance = await Promise.all(agents.map(async (agent) => {
                const assignedLeads = await prisma.lead.count({
                    where: {
                        tenantId,
                        agentLeads: { some: { agentId: agent.id } }
                    }
                });

                const convertedLeads = await prisma.lead.count({
                    where: {
                        tenantId,
                        status: 4, // Converted
                        agentLeads: { some: { agentId: agent.id } }
                    }
                });

                const revenueResult = await prisma.booking.aggregate({
                    where: { tenantId, agentId: agent.id, status: { in: [2, 4] } },
                    _sum: { totalPrice: true }
                });

                return {
                    id: agent.id,
                    name: agent.user.name,
                    totalLeads: assignedLeads,
                    conversions: convertedLeads,
                    revenue: parseFloat(revenueResult._sum.totalPrice || 0),
                    conversionRate: assignedLeads > 0 ? (convertedLeads / assignedLeads) * 100 : 0
                };
            }));

            res.json({ success: true, data: performance });
        } catch (error) {
            console.error('Agent performance error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    },

    // 3. Search Trends
    getSearchTrends: async (req, res) => {
        try {
            const { tenantId: queryTenantId } = req.query;
            const tenantId = queryTenantId || req.tenant?.id || req.user?.tenantId;

            const searches = await prisma.leadInteraction.findMany({
                where: { tenantId, type: 'SEARCH' },
                select: { metadata: true }
            });

            const keywords = {};
            const cities = {};

            searches.forEach(s => {
                const kw = s.metadata?.keyword?.toLowerCase();
                const city = s.metadata?.city;

                if (kw) keywords[kw] = (keywords[kw] || 0) + 1;
                if (city) cities[city] = (cities[city] || 0) + 1;
            });

            const topKeywords = Object.entries(keywords)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([name, count]) => ({ name, count }));

            const topCities = Object.entries(cities)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([name, count]) => ({ name, count }));

            res.json({ success: true, data: { topKeywords, topCities } });
        } catch (error) {
            console.error('Search trends error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    },

    // 4. Campaign Performance
    getCampaignPerformance: async (req, res) => {
        try {
            const { tenantId: queryTenantId } = req.query;
            const tenantId = queryTenantId || req.tenant?.id || req.user?.tenantId;

            const campaigns = await prisma.campaign.findMany({
                where: { tenantId },
                include: {
                    _count: {
                        select: { logs: true }
                    }
                }
            });

            const stats = await Promise.all(campaigns.map(async (c) => {
                // Find leads generated by this campaign (if we track campaign source on lead)
                // For now, let's assume interactions track campaign info
                const interactions = await prisma.leadInteraction.count({
                    where: {
                        tenantId,
                        metadata: {
                            path: ['campaignId'],
                            equals: c.id
                        }
                    }
                });

                return {
                    id: c.id,
                    name: c.name,
                    sent: c._count.logs,
                    interactions: interactions,
                    engagement: c._count.logs > 0 ? (interactions / c._count.logs) * 100 : 0
                };
            }));

            res.json({ success: true, data: stats });
        } catch (error) {
            console.error('Campaign performance error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }
};

module.exports = analyticsController;
