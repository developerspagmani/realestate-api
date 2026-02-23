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

            const keywords = {};
            const cities = {};

            try {
                const searches = await prisma.leadInteraction.findMany({
                    where: {
                        tenantId,
                        type: { in: ['SEARCH', 'SEARCH_FILTER', 'PROPERTY_VIEW'] }
                    },
                    select: { type: true, metadata: true }
                });

                searches.forEach(s => {
                    const kw = s.metadata?.keyword?.toLowerCase();
                    const city = s.metadata?.city;
                    if (kw) keywords[kw] = (keywords[kw] || 0) + 1;
                    if (city) cities[city] = (cities[city] || 0) + 1;
                    if (s.metadata?.propertyType) {
                        const pt = s.metadata.propertyType.toLowerCase();
                        keywords[pt] = (keywords[pt] || 0) + 1;
                    }
                });
            } catch (interactionErr) {
                console.warn('LeadInteraction table not available for search trends:', interactionErr.message);
            }

            const topKeywords = Object.entries(keywords)
                .sort((a, b) => b[1] - a[1]).slice(0, 10)
                .map(([name, count]) => ({ name, count }));
            const topCities = Object.entries(cities)
                .sort((a, b) => b[1] - a[1]).slice(0, 10)
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
                include: { _count: { select: { logs: true } } }
            });

            const stats = await Promise.all(campaigns.map(async (c) => {
                let interactions = 0;
                try {
                    interactions = await prisma.leadInteraction.count({
                        where: {
                            tenantId,
                            metadata: { path: ['campaignId'], equals: c.id }
                        }
                    });
                } catch (interactionErr) {
                    console.warn('LeadInteraction table not available for campaign stats:', interactionErr.message);
                }
                return {
                    id: c.id,
                    name: c.name,
                    sent: c.deliveredCount || 0,
                    interactions,
                    engagement: (c.deliveredCount || 0) > 0 ? (interactions / c.deliveredCount) * 100 : 0
                };
            }));

            res.json({ success: true, data: stats });
        } catch (error) {
            console.error('Campaign performance error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    },

    // 5. Marketing Insights (Top 5 GA-style reports)
    getMarketingInsights: async (req, res) => {
        try {
            const { tenantId: queryTenantId, startDate, endDate, campaignId, propertyId } = req.query;
            let tenantId = queryTenantId || req.tenant?.id || req.user?.tenantId;

            if (!tenantId || tenantId === 'undefined' || tenantId === 'null') {
                return res.status(400).json({ success: false, message: 'Valid Tenant ID required' });
            }

            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId);
            if (!isUuid) {
                return res.status(400).json({ success: false, message: 'Invalid Tenant ID format' });
            }

            // Common filters
            const dateFilter = {};
            if (startDate && startDate !== '' && !isNaN(new Date(startDate).getTime())) {
                dateFilter.gte = new Date(startDate);
            }
            if (endDate && endDate !== '' && !isNaN(new Date(endDate).getTime())) {
                dateFilter.lte = new Date(endDate);
            }

            const leadWhere = { tenantId };
            if (Object.keys(dateFilter).length > 0) leadWhere.createdAt = dateFilter;
            if (propertyId) leadWhere.propertyId = propertyId;

            // Report 1: Lead Source Attribution
            const sourceCounts = await prisma.lead.groupBy({
                by: ['source'],
                where: leadWhere,
                _count: { id: true }
            });

            const sourceLabels = {
                1: 'Website', 2: 'Email', 3: 'Phone', 4: 'Social',
                5: 'Referral', 6: 'Other', 7: 'Chatbot'
            };

            const leadSources = sourceCounts.map(s => ({
                source: sourceLabels[s.source] || 'Direct/Unknown',
                count: s._count.id
            }));

            // Report 2: Property Traffic (Top Views)
            // Wrapped in try/catch in case the lead_interactions table hasn't been migrated yet
            const propertyHits = {};
            const keywords = {};
            const cityDemand = {};
            const pricePoints = [];

            try {
                const interactionWhere = {
                    tenantId,
                    type: { in: ['PROPERTY_VIEW', 'PROPERTY_DETAIL_VIEW', 'SEARCH', 'SEARCH_FILTER'] }
                };
                if (Object.keys(dateFilter).length > 0) interactionWhere.occurredAt = dateFilter;

                const interactions = await prisma.leadInteraction.findMany({
                    where: interactionWhere,
                    select: { type: true, metadata: true }
                });

                interactions.forEach(i => {
                    // Tracking views
                    if (i.type.includes('PROPERTY')) {
                        const pid = i.metadata?.propertyId;
                        const title = i.metadata?.title || 'Unknown Property';
                        if (pid) {
                            if (propertyId && pid !== propertyId) return;
                            if (!propertyHits[pid]) propertyHits[pid] = { id: pid, title, views: 0 };
                            propertyHits[pid].views++;
                        }
                    }

                    // Tracking Search Intelligence
                    if (i.type === 'SEARCH' || i.type === 'SEARCH_FILTER') {
                        if (campaignId && i.metadata?.campaignId !== campaignId) return;

                        const kw = i.metadata?.keyword?.toLowerCase();
                        const city = i.metadata?.city;
                        const price = parseFloat(i.metadata?.price || i.metadata?.budget);

                        if (kw) keywords[kw] = (keywords[kw] || 0) + 1;
                        if (city) cityDemand[city] = (cityDemand[city] || 0) + 1;
                        if (!isNaN(price) && price > 0) pricePoints.push(price);
                    }
                });
            } catch (interactionErr) {
                console.warn('LeadInteraction table not available or query failed:', interactionErr.message);
                // Continue with empty interaction data — other reports will still work
            }



            const topProperties = Object.values(propertyHits)
                .sort((a, b) => b.views - a.views)
                .slice(0, 5);

            const topSearchKeywords = Object.entries(keywords)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([name, count]) => ({ name, count }));

            // Report 3: Lead Generation Trend
            let trendDays = 30;
            let trendStart = new Date();
            trendStart.setDate(trendStart.getDate() - 30);

            if (startDate && endDate && !isNaN(new Date(startDate).getTime()) && !isNaN(new Date(endDate).getTime())) {
                trendDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 3600 * 24));
                trendStart = new Date(startDate);
            } else if (startDate && !isNaN(new Date(startDate).getTime())) {
                trendStart = new Date(startDate);
                // Adjust trendDays if we have start but no end? Usually let it be 30 from that point
            }

            const leadsTrend = await prisma.lead.findMany({
                where: leadWhere,
                select: { createdAt: true }
            });

            const days = {};
            for (let i = 0; i < trendDays; i++) {
                const d = new Date(trendStart);
                d.setDate(d.getDate() + i);
                days[d.toISOString().split('T')[0]] = 0;
            }

            leadsTrend.forEach(l => {
                const date = l.createdAt.toISOString().split('T')[0];
                if (days[date] !== undefined) days[date]++;
            });

            const genTrend = Object.entries(days)
                .map(([date, count]) => ({ date, count }))
                .sort((a, b) => a.date.localeCompare(b.date));

            // Report 4: Lead Quality
            const qualityDist = [
                { range: 'High (50+)', count: await prisma.lead.count({ where: { ...leadWhere, leadScore: { gte: 50 } } }) },
                { range: 'Medium (20-49)', count: await prisma.lead.count({ where: { ...leadWhere, leadScore: { gte: 20, lt: 50 } } }) },
                { range: 'Low (0-19)', count: await prisma.lead.count({ where: { ...leadWhere, leadScore: { lt: 20 } } }) }
            ];

            // Report 5: Conversion Velocity
            const convertedLeads = await prisma.lead.findMany({
                where: { ...leadWhere, status: 4 },
                select: { createdAt: true, updatedAt: true }
            });

            let totalDays = 0;
            convertedLeads.forEach(l => {
                if (l.updatedAt && l.createdAt) {
                    const diff = l.updatedAt.getTime() - l.createdAt.getTime();
                    totalDays += diff / (1000 * 3600 * 24);
                }
            });
            const avgVelocity = convertedLeads.length > 0 ? (totalDays / convertedLeads.length).toFixed(1) : 0;

            // Report 6: Forecasting AI Prediction (Demand vs Supply)
            const properties = await prisma.property.findMany({
                where: { tenantId },
                select: { price: true, city: true, propertyType: true }
            });

            const predictions = [];
            // logic: find cities with high search but low inventory
            Object.entries(cityDemand).forEach(([city, count]) => {
                const supplyCount = properties.filter(p => p.city?.toLowerCase() === city.toLowerCase()).length;
                if (count > supplyCount * 2 && count > 5) {
                    predictions.push({
                        type: 'INVENTORY_SHORTAGE',
                        location: city,
                        demandLevel: count > 20 ? 'Critical' : 'High',
                        recommendation: `High demand in ${city} with low inventory. Suggest adding properties in the $${(pricePoints.reduce((a, b) => a + b, 0) / pricePoints.length || 500000).toLocaleString()} range.`
                    });
                }
            });

            // logic: price gap analysis
            if (pricePoints.length > 0 && properties.length > 0) {
                const avgDemandPrice = pricePoints.reduce((a, b) => a + b, 0) / pricePoints.length;
                const avgSupplyPrice = properties.reduce((a, b) => a + parseFloat(b.price || 0), 0) / properties.length;
                if (avgSupplyPrice > 0 && Math.abs(avgDemandPrice - avgSupplyPrice) > avgSupplyPrice * 0.2) {
                    predictions.push({
                        type: 'PRICE_OPTIMIZATION',
                        location: 'Global',
                        demandLevel: 'Medium',
                        recommendation: `Average user budget is $${avgDemandPrice.toLocaleString()} but your average listing is $${avgSupplyPrice.toLocaleString()}. Suggest restocking properties closer to the user budget.`
                    });
                }
            }

            res.json({
                success: true,
                data: {
                    leadSources,
                    topProperties,
                    genTrend,
                    qualityDist,
                    avgVelocity,
                    topSearchKeywords,
                    forecastingAI: predictions
                }
            });
        } catch (error) {
            console.error('Marketing insights error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error fetching marketing insights',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
};

module.exports = analyticsController;
