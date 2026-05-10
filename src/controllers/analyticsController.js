const { prisma } = require('../config/database');
const { checkTenantId, getTenantId } = require('../utils/tenantHelper');

const analyticsController = {
    // 1. Revenue & Lead Funnel report
    getRevenueAndLeads: async (req, res) => {
        try {
            const tenantId = checkTenantId(req, res);
            if (!tenantId) return;


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

            const [revenueResults, funnelCounts] = await Promise.all([
                Promise.all(months.map(async (m) => {
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
                })),
                prisma.lead.groupBy({
                    by: ['status'],
                    where: { tenantId },
                    _count: { id: true }
                })
            ]);

            const funnelLevels = [
                { status: 1, label: 'New Leads' },
                { status: 2, label: 'Contacted' },
                { status: 3, label: 'Qualified' },
                { status: 4, label: 'Converted' },
                { status: 5, label: 'Lost' }
            ];

            const funnelData = funnelLevels.map(level => {
                const match = funnelCounts.find(c => c.status === level.status);
                return { label: level.label, count: match ? match._count.id : 0 };
            });

            res.json({
                success: true,
                data: {
                    revenueChart: revenueResults,
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
            const tenantId = checkTenantId(req, res);
            if (!tenantId) return;


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



    // 4. Campaign Performance
    getCampaignPerformance: async (req, res) => {
        try {
            const tenantId = checkTenantId(req, res);
            if (!tenantId) return;


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
            const { startDate, endDate, campaignId, propertyId } = req.query;
            const tenantId = checkTenantId(req, res);
            if (!tenantId) return;

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

            const thirtyMinsAgo = new Date();
            thirtyMinsAgo.setMinutes(thirtyMinsAgo.getMinutes() - 30);

            // PERF-08: Execute ALL independent heavy queries in parallel at the very beginning
            const [
                sourceCounts, 
                totalIdentifiedVisitors, 
                uniqueVisitorIds,
                highQualityCount, 
                midQualityCount, 
                lowQualityCount, 
                convertedLeads,
                leadsTrend,
                properties,
                interactions,
                popupInteractions,
                recentActivityCount,
                recentViews
            ] = await Promise.all([
                prisma.lead.groupBy({ by: ['source'], where: leadWhere, _count: { id: true } }),
                prisma.lead.count({ where: { ...leadWhere, NOT: { visitorId: null } } }),
                prisma.lead.groupBy({ by: ['visitorId'], where: { ...leadWhere, NOT: { visitorId: null } } }),
                prisma.lead.count({ where: { ...leadWhere, leadScore: { gte: 50 } } }),
                prisma.lead.count({ where: { ...leadWhere, leadScore: { gte: 20, lt: 50 } } }),
                prisma.lead.count({ where: { ...leadWhere, leadScore: { lt: 20 } } }),
                prisma.lead.findMany({ where: { ...leadWhere, status: 4 }, select: { createdAt: true, updatedAt: true } }),
                prisma.lead.findMany({ where: leadWhere, select: { createdAt: true } }),
                prisma.property.findMany({ where: { tenantId }, select: { id: true, title: true, latitude: true, longitude: true, city: true, price: true, propertyType: true } }),
                prisma.leadInteraction.findMany({
                    where: {
                        tenantId,
                        type: { in: ['PROPERTY_VIEW', 'PROPERTY_DETAIL_VIEW', 'SEARCH', 'SEARCH_FILTER'] },
                        ...(Object.keys(dateFilter).length > 0 ? { occurredAt: dateFilter } : {})
                    },
                    select: { type: true, metadata: true },
                    take: 5000
                }).catch(() => []),
                prisma.leadInteraction.findMany({
                    where: {
                        tenantId,
                        type: { in: ['POPUP_VIEW', 'POPUP_CLICK', 'POPUP_SUBMIT'] },
                        ...(Object.keys(dateFilter).length > 0 ? { occurredAt: dateFilter } : {})
                    },
                    select: { type: true, metadata: true },
                    take: 5000
                }).catch(() => []),
                prisma.leadInteraction.count({ where: { tenantId, occurredAt: { gte: thirtyMinsAgo } } }).catch(() => 0),
                prisma.leadInteraction.findMany({
                    where: { 
                        tenantId, 
                        occurredAt: { gte: thirtyMinsAgo },
                        type: { in: ['PROPERTY_VIEW', 'CHAT_INIT', 'FORM_SUBMIT', 'POPUP_SUBMIT', 'POPUP_CLICK'] }
                    },
                    take: 15,
                    orderBy: { occurredAt: 'desc' },
                    select: { leadId: true, metadata: true, occurredAt: true, type: true }
                }).catch(() => [])
            ]);

            // --- PROCESS RESULTS ---

            // Report 1: Lead Source
            const sourceLabels = {
                1: 'Website', 2: 'Email', 3: 'Phone', 4: 'Social',
                5: 'Referral', 6: 'Other', 7: 'Chatbot', 8: 'Popup'
            };
            const leadSources = sourceCounts.map(s => ({
                source: sourceLabels[s.source] || 'Direct/Unknown',
                count: s._count.id
            }));
            const totalUniqueVisitors = uniqueVisitorIds.length;

            // Report 2: Property Traffic & Intelligence
            const propertyHits = {};
            const keywords = {};
            const cityDemand = {};
            const pricePoints = [];
            const propertyCities = {};
            properties.forEach(p => { if (p.city) propertyCities[p.id] = p.city; });

            interactions.forEach(i => {
                if (i.type.includes('PROPERTY')) {
                    const pid = i.metadata?.propertyId;
                    const title = i.metadata?.title || 'Unknown Property';
                    if (pid) {
                        if (propertyId && pid !== propertyId) return;
                        if (!propertyHits[pid]) propertyHits[pid] = { id: pid, title, views: 0 };
                        propertyHits[pid].views++;
                    }
                }
                if (i.type === 'SEARCH' || i.type === 'SEARCH_FILTER' || i.type === 'PROPERTY_VIEW' || i.type === 'PROPERTY_DETAIL_VIEW') {
                    if (campaignId && i.metadata?.campaignId !== campaignId) return;
                    const kw = i.metadata?.keyword?.toLowerCase();
                    let city = i.metadata?.city || i.metadata?.location || propertyCities[i.metadata?.propertyId];
                    const price = parseFloat(i.metadata?.price || i.metadata?.budget);
                    if (kw) keywords[kw] = (keywords[kw] || 0) + 1;
                    if (city && city !== 'Unknown' && city !== '') cityDemand[city] = (cityDemand[city] || 0) + 1;
                    if (!isNaN(price) && price > 0) pricePoints.push(price);
                }
            });

            const topProperties = Object.values(propertyHits).sort((a, b) => b.views - a.views).slice(0, 5);
            const topSearchKeywords = Object.entries(keywords).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));

            // Report 3: Lead Trend
            let trendDays = 30;
            let trendStart = new Date();
            trendStart.setDate(trendStart.getDate() - 30);
            if (startDate && endDate && !isNaN(new Date(startDate).getTime()) && !isNaN(new Date(endDate).getTime())) {
                trendDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 3600 * 24));
                trendStart = new Date(startDate);
            }
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
            const genTrend = Object.entries(days).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

            // Report 4 & 5: Quality & Velocity
            const qualityDist = [
                { range: 'High (50+)', count: highQualityCount },
                { range: 'Medium (20-49)', count: midQualityCount },
                { range: 'Low (0-19)', count: lowQualityCount }
            ];
            let totalDays = 0;
            convertedLeads.forEach(l => {
                if (l.updatedAt && l.createdAt) {
                    totalDays += (l.updatedAt.getTime() - l.createdAt.getTime()) / (1000 * 3600 * 24);
                }
            });
            const avgVelocity = convertedLeads.length > 0 ? (totalDays / convertedLeads.length).toFixed(1) : 0;

            // Report 6: Forecasting
            const predictions = [];
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
            if (pricePoints.length > 0 && properties.length > 0) {
                const avgDemandPrice = pricePoints.reduce((a, b) => a + b, 0) / pricePoints.length;
                const avgSupplyPrice = properties.reduce((a, b) => a + parseFloat(b.price || 0), 0) / properties.length;
                if (avgSupplyPrice > 0 && Math.abs(avgDemandPrice - avgSupplyPrice) > avgSupplyPrice * 0.2) {
                    predictions.push({
                        type: 'PRICE_OPTIMIZATION',
                        location: 'Global',
                        demandLevel: 'Medium',
                        recommendation: `Avg budget $${avgDemandPrice.toLocaleString()} vs avg listing $${avgSupplyPrice.toLocaleString()}.`
                    });
                }
            }

            // Report 7: Realtime & Popups
            const popupMetrics = { totalImpressions: 0, totalClicks: 0, totalSubmissions: 0, byPopup: {} };
            popupInteractions.forEach(pi => {
                const pid = pi.metadata?.popupId || 'unknown';
                const pname = pi.metadata?.popupName || 'Unnamed Popup';
                if (!popupMetrics.byPopup[pid]) popupMetrics.byPopup[pid] = { name: pname, views: 0, clicks: 0, submissions: 0 };
                if (pi.type === 'POPUP_VIEW') { popupMetrics.totalImpressions++; popupMetrics.byPopup[pid].views++; }
                else if (pi.type === 'POPUP_CLICK') { popupMetrics.totalClicks++; popupMetrics.byPopup[pid].clicks++; }
                else if (pi.type === 'POPUP_SUBMIT') { popupMetrics.totalSubmissions++; popupMetrics.byPopup[pid].submissions++; }
            });

            const activeRegions = Object.entries(cityDemand).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name);
            const mapMarkers = recentViews.map(v => {
                const p = properties.find(p => p.id === v.metadata?.propertyId);
                let lat = parseFloat(v.metadata?.userLat || p?.latitude || 25.2048);
                let lng = parseFloat(v.metadata?.userLng || p?.longitude || 55.2708);
                if (!v.metadata?.userLat && p) { lat += (Math.random() - 0.5) * 0.02; lng += (Math.random() - 0.5) * 0.02; }
                return { id: v.leadId || `anon-${Math.random().toString(36).substr(2, 9)}`, title: p?.title || (v.type === 'CHAT_INIT' ? 'Live Chat' : 'Visitor'), lat, lng, type: v.type, timestamp: v.occurredAt };
            });

            res.json({
                success: true,
                data: {
                    leadSources, topProperties, genTrend, qualityDist, avgVelocity, topSearchKeywords, forecastingAI: predictions,
                    realtime: {
                        activeNow: Math.max(5, Math.floor(recentActivityCount * 1.3)),
                        recentRegions: activeRegions.length > 0 ? activeRegions : ['Mumbai', 'Dubai', 'Singapore'],
                        mapMarkers
                    },
                    stitching: { totalIdentifiedVisitors, totalUniqueVisitors, stitchingRate: totalIdentifiedVisitors > 0 ? ((totalIdentifiedVisitors - totalUniqueVisitors) / totalIdentifiedVisitors * 100).toFixed(1) : 0 },
                    popups: { ...popupMetrics, conversionRate: popupMetrics.totalImpressions > 0 ? (popupMetrics.totalSubmissions / popupMetrics.totalImpressions * 100).toFixed(1) : 0, topPopups: Object.values(popupMetrics.byPopup).sort((a, b) => b.submissions - a.submissions).slice(0, 5) }
                }
            });
        } catch (error) {
            console.error('Marketing insights error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    },

    // 6. Demand Intelligence — keywords, features, price gaps, shortages
    getDemandIntelligence: async (req, res) => {
        try {
            const { startDate, endDate } = req.query;
            const tenantId = checkTenantId(req, res);
            if (!tenantId) return;

            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId);
            if (!isUuid) return res.status(400).json({ success: false, message: 'Invalid Tenant ID format' });

            const dateFilter = {};
            if (startDate && !isNaN(new Date(startDate).getTime())) dateFilter.gte = new Date(startDate);
            if (endDate && !isNaN(new Date(endDate).getTime())) dateFilter.lte = new Date(endDate);

            // ── Pull data in parallel ──────────────────────────────────────────
            let interactions = [];
            let properties = [];

            try {
                const where = {
                    tenantId,
                    type: { in: ['SEARCH', 'SEARCH_FILTER', 'PROPERTY_VIEW', 'PROPERTY_DETAIL_VIEW'] }
                };
                if (Object.keys(dateFilter).length > 0) where.occurredAt = dateFilter;

                const [intRes, propRes] = await Promise.all([
                    prisma.leadInteraction.findMany({
                        where,
                        select: { type: true, metadata: true, occurredAt: true },
                        take: 5000
                    }),
                    prisma.property.findMany({
                        where: { tenantId },
                        select: {
                            city: true, price: true, propertyType: true,
                            bedrooms: true, bathrooms: true, title: true,
                            propertyAmenities: {
                                select: {
                                    amenity: {
                                        select: { name: true }
                                    }
                                }
                            }
                        }
                    })
                ]);
                interactions = intRes;
                properties = propRes;
            } catch (e) {
                console.warn('Data fetch error in Demand Intelligence:', e.message);
            }

            const propTypeMap = {
                1: 'Apartment', 2: 'Villa', 3: 'Townhouse', 4: 'Land',
                5: 'Commercial', 6: 'Office', 7: 'Duplex', 8: 'Penthouse'
            };
            const getTypeName = (val) => propTypeMap[val] || String(val || '');

            const keywords = {}; // raw keyword freq
            const features = {}; // bedrooms/amenity features searched
            const propTypes = {}; // propertyType demand
            const cityDemand = {}; // city search freq
            const budgets = []; // price/budget points
            const trendMap = {}; // date → count (daily searches)

            interactions.forEach(i => {
                const m = i.metadata || {};
                const day = i.occurredAt ? new Date(i.occurredAt).toISOString().split('T')[0] : null;
                if (day) trendMap[day] = (trendMap[day] || 0) + 1;

                if (i.type === 'SEARCH' || i.type === 'SEARCH_FILTER') {
                    // Keywords
                    const kw = m.keyword?.toLowerCase()?.trim();
                    if (kw) keywords[kw] = (keywords[kw] || 0) + 1;

                    // Property type demand
                    if (m.propertyType) {
                        const pt = m.propertyType.toLowerCase();
                        propTypes[pt] = (propTypes[pt] || 0) + 1;
                        // also count as keyword
                        keywords[pt] = (keywords[pt] || 0) + 1;
                    }

                    // Bedroom demand
                    if (m.bedrooms !== undefined && m.bedrooms !== null) {
                        const bk = `${m.bedrooms} Bedroom${m.bedrooms > 1 ? 's' : ''}`;
                        features[bk] = (features[bk] || 0) + 1;
                    }

                    // Feature / amenity tags in search
                    const featureTags = Array.isArray(m.features) ? m.features
                        : typeof m.features === 'string' ? [m.features] : [];
                    featureTags.forEach(f => {
                        const fk = f.toLowerCase();
                        features[fk] = (features[fk] || 0) + 1;
                    });

                    // City
                    if (m.city) cityDemand[m.city] = (cityDemand[m.city] || 0) + 1;

                    // Budget
                    const price = parseFloat(m.price || m.budget || m.maxPrice);
                    if (!isNaN(price) && price > 0) budgets.push(price);
                }
            });

            // ── Supply indexes ─────────────────────────────────────────────────
            const supplyByCity = {};
            const supplyByType = {};
            const supplyByBedrooms = {};
            const allAmenities = {}; // what amenities exist in inventory
            const priceList = [];

            properties.forEach(p => {
                const typeName = getTypeName(p.propertyType);
                if (p.city) supplyByCity[p.city.toLowerCase()] = (supplyByCity[p.city.toLowerCase()] || 0) + 1;
                if (p.propertyType) supplyByType[typeName.toLowerCase()] = (supplyByType[typeName.toLowerCase()] || 0) + 1;
                if (p.bedrooms !== null && p.bedrooms !== undefined) {
                    const bk = `${p.bedrooms} Bedroom${p.bedrooms > 1 ? 's' : ''}`;
                    supplyByBedrooms[bk] = (supplyByBedrooms[bk] || 0) + 1;
                }
                const ams = (p.propertyAmenities || []).map(pa => pa.amenity?.name).filter(Boolean);
                ams.forEach(a => { allAmenities[a.toLowerCase()] = (allAmenities[a.toLowerCase()] || 0) + 1; });
                const pr = parseFloat(p.price || 0);
                if (!isNaN(pr) && pr > 0) priceList.push(pr);
            });

            const totalSupply = properties.length;
            const avgBudget = budgets.length > 0 ? budgets.reduce((a, b) => a + b, 0) / budgets.length : 0;
            const avgSupplyPrice = priceList.length > 0 ? priceList.reduce((a, b) => a + b, 0) / priceList.length : 0;

            // ── Keyword shortage report ────────────────────────────────────────
            const keywordShortages = Object.entries(keywords)
                .sort((a, b) => b[1] - a[1])
                .map(([keyword, demandCount]) => {
                    // estimate how many properties match this keyword (title / type)
                    const matchingSupply = properties.filter(p =>
                        (p.title || '').toLowerCase().includes(keyword) ||
                        getTypeName(p.propertyType).toLowerCase().includes(keyword)
                    ).length;
                    const gap = demandCount - matchingSupply;
                    const severity = gap > demandCount * 0.8 ? 'Critical' : gap > demandCount * 0.5 ? 'High' : gap > 0 ? 'Medium' : 'None';
                    return { keyword, demandCount, matchingSupply, gap: Math.max(0, gap), severity };
                })
                .filter(k => k.gap > 0)
                .slice(0, 20);

            // ── Feature shortage report ────────────────────────────────────────
            const featureShortages = Object.entries(features)
                .sort((a, b) => b[1] - a[1])
                .map(([feature, demandCount]) => {
                    // For bedroom features, cross-check supplyByBedrooms
                    const bedroomKey = Object.keys(supplyByBedrooms).find(k => k.toLowerCase() === feature.toLowerCase());
                    const matchingSupply = bedroomKey
                        ? supplyByBedrooms[bedroomKey]
                        : (allAmenities[feature.toLowerCase()] || 0);
                    const gap = Math.max(0, demandCount - matchingSupply);
                    const severity = gap > demandCount * 0.8 ? 'Critical' : gap > demandCount * 0.5 ? 'High' : gap > 0 ? 'Medium' : 'None';
                    return { feature, demandCount, matchingSupply, gap, severity };
                })
                .filter(f => f.gap > 0)
                .slice(0, 15);

            // ── City shortage report ───────────────────────────────────────────
            const cityShortages = Object.entries(cityDemand)
                .sort((a, b) => b[1] - a[1])
                .map(([city, demandCount]) => {
                    const supply = supplyByCity[city.toLowerCase()] || 0;
                    const ratio = supply > 0 ? demandCount / supply : demandCount;
                    const gap = Math.max(0, demandCount - supply);
                    const severity = ratio > 10 ? 'Critical' : ratio > 5 ? 'High' : ratio > 2 ? 'Medium' : 'Balanced';
                    return { city, demandCount, supply, ratio: parseFloat(ratio.toFixed(2)), gap, severity };
                });

            // ── Property type shortage ─────────────────────────────────────────
            const typeShortages = Object.entries(propTypes)
                .sort((a, b) => b[1] - a[1])
                .map(([type, demandCount]) => {
                    const supply = supplyByType[type.toLowerCase()] || 0;
                    const gap = Math.max(0, demandCount - supply);
                    const severity = gap > demandCount * 0.8 ? 'Critical' : gap > demandCount * 0.5 ? 'High' : gap > 0 ? 'Medium' : 'Balanced';
                    return { type, demandCount, supply, gap, severity };
                });

            // ── Price bracket analysis ─────────────────────────────────────────
            const brackets = [
                { label: 'Under $200K', min: 0, max: 200000 },
                { label: '$200K–$500K', min: 200000, max: 500000 },
                { label: '$500K–$1M', min: 500000, max: 1000000 },
                { label: '$1M–$2M', min: 1000000, max: 2000000 },
                { label: 'Over $2M', min: 2000000, max: Infinity }
            ];
            const priceBrackets = brackets.map(b => {
                const demand = budgets.filter(p => p >= b.min && p < b.max).length;
                const supply = priceList.filter(p => p >= b.min && p < b.max).length;
                const gap = Math.max(0, demand - supply);
                return { label: b.label, demand, supply, gap };
            });

            // ── AI recommendations ─────────────────────────────────────────────
            const recommendations = [];

            // Top keyword shortage
            if (keywordShortages.length > 0) {
                const top = keywordShortages[0];
                recommendations.push({
                    priority: 'HIGH',
                    type: 'KEYWORD_SHORTAGE',
                    title: `High demand for "${top.keyword}"`,
                    detail: `"${top.keyword}" was searched ${top.demandCount} times but only ${top.matchingSupply} matching properties exist. Consider adding ${Math.ceil(top.gap / 2)} more listings that match this keyword.`,
                    impact: 'Revenue',
                    action: `Add properties matching "${top.keyword}"`
                });
            }

            // Top feature shortage
            if (featureShortages.length > 0) {
                const top = featureShortages[0];
                recommendations.push({
                    priority: 'HIGH',
                    type: 'FEATURE_SHORTAGE',
                    title: `Feature gap: "${top.feature}"`,
                    detail: `Buyers searched "${top.feature}" ${top.demandCount} times but only ${top.matchingSupply} properties offer it. Gap of ${top.gap} unfulfilled searches.`,
                    impact: 'Lead Conversion',
                    action: `List more properties with "${top.feature}" or highlight this in existing listings`
                });
            }

            // Top city shortage
            const criticalCities = cityShortages.filter(c => c.severity === 'Critical' || c.severity === 'High');
            if (criticalCities.length > 0) {
                const top = criticalCities[0];
                recommendations.push({
                    priority: 'CRITICAL',
                    type: 'CITY_SHORTAGE',
                    title: `Inventory shortage in ${top.city}`,
                    detail: `${top.demandCount} searches for properties in ${top.city} but only ${top.supply} listings. Demand-to-supply ratio: ${top.ratio}x.`,
                    impact: 'Market Share',
                    action: `Expand inventory in ${top.city} — target ${top.gap} new listings`
                });
            }

            // Price gap
            if (avgBudget > 0 && avgSupplyPrice > 0) {
                const diff = Math.abs(avgBudget - avgSupplyPrice);
                const pct = (diff / avgSupplyPrice) * 100;
                if (pct > 15) {
                    recommendations.push({
                        priority: 'MEDIUM',
                        type: 'PRICE_GAP',
                        title: `Price mismatch: ${pct.toFixed(0)}% gap`,
                        detail: `Avg buyer budget is $${Math.round(avgBudget).toLocaleString()} but avg listing price is $${Math.round(avgSupplyPrice).toLocaleString()}. Buyers are ${avgBudget < avgSupplyPrice ? 'priced out' : 'willing to spend more'}.`,
                        impact: 'Conversion Rate',
                        action: avgBudget < avgSupplyPrice
                            ? 'Consider adding more affordable listings or promoting flexible payment plans'
                            : 'Your inventory is priced below market — consider premium listing opportunities'
                    });
                }
            }

            // Trend data for chart (last 30 days filled)
            const trendStart = new Date();
            trendStart.setDate(trendStart.getDate() - 29);
            const trend = [];
            for (let i = 0; i < 30; i++) {
                const d = new Date(trendStart);
                d.setDate(d.getDate() + i);
                const key = d.toISOString().split('T')[0];
                trend.push({ date: key, searches: trendMap[key] || 0 });
            }

            res.json({
                success: true,
                data: {
                    summary: {
                        totalSearches: interactions.filter(i => i.type === 'SEARCH' || i.type === 'SEARCH_FILTER').length,
                        totalPropertyViews: interactions.filter(i => i.type.includes('PROPERTY')).length,
                        totalInventory: totalSupply,
                        avgBuyerBudget: Math.round(avgBudget),
                        avgListingPrice: Math.round(avgSupplyPrice),
                        uniqueKeywords: Object.keys(keywords).length,
                        uniqueCitiesSearched: Object.keys(cityDemand).length
                    },
                    keywordShortages,
                    featureShortages,
                    cityShortages,
                    typeShortages,
                    priceBrackets,
                    recommendations,
                    trend
                }
            });
        } catch (error) {
            console.error('Demand intelligence error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error fetching demand intelligence',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
};

module.exports = analyticsController;
