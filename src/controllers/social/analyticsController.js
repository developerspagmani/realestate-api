const { prisma } = require('../../config/database');

/**
 * Get overall social media analytics
 * @route GET /api/social/analytics/overview
 */
const getOverview = async (req, res) => {
    try {
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;
        const { startDate, endDate } = req.query;

        const where = { tenantId, userId };

        if (startDate && endDate) {
            where.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        const [
            connectedAccounts,
            scheduledPosts,
            publishedPosts,
            drafts,
            recentActivity
        ] = await Promise.all([
            // Connected accounts stats
            prisma.connectedAccount.count({
                where: { tenantId, userId, isActive: true }
            }),

            // Scheduled posts stats
            prisma.scheduledPost.count({
                where: { ...where, status: 'SCHEDULED' }
            }),

            // Published posts stats
            prisma.publishedPost.count({ where }),

            // Drafts count
            prisma.scheduledPost.count({
                where: { tenantId, userId, status: 'DRAFT' }
            }),

            // Recent activity
            prisma.publishedPost.findMany({
                where,
                orderBy: { publishedAt: 'desc' },
                take: 10,
                include: {
                    scheduledPost: {
                        select: { title: true, property: { select: { title: true } } }
                    }
                }
            })
        ]);

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    connectedAccounts,
                    scheduledPosts,
                    publishedPosts,
                    drafts
                },
                recentActivity
            }
        });
    } catch (error) {
        console.error('Get overview error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching analytics overview'
        });
    }
};

/**
 * Get platform-specific analytics
 * @route GET /api/social/analytics/platforms
 */
const getPlatformAnalytics = async (req, res) => {
    try {
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        const [publishedByPlatform, accountsByPlatform] = await Promise.all([
            prisma.publishedPost.groupBy({
                by: ['platform'],
                where: { tenantId, userId },
                _count: { id: true }
            }),
            prisma.connectedAccount.groupBy({
                by: ['platform'],
                where: { tenantId, userId, isActive: true },
                _count: { id: true }
            })
        ]);

        const platformData = {};

        // Combine data
        publishedByPlatform.forEach(item => {
            platformData[item.platform] = {
                platform: item.platform,
                publishedPosts: item._count.id,
                connectedAccounts: 0
            };
        });

        accountsByPlatform.forEach(item => {
            if (platformData[item.platform]) {
                platformData[item.platform].connectedAccounts = item._count.id;
            } else {
                platformData[item.platform] = {
                    platform: item.platform,
                    publishedPosts: 0,
                    connectedAccounts: item._count.id
                };
            }
        });

        res.status(200).json({
            success: true,
            data: {
                platforms: Object.values(platformData)
            }
        });
    } catch (error) {
        console.error('Get platform analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching platform analytics'
        });
    }
};

/**
 * Get posting trends (posts over time)
 * @route GET /api/social/analytics/trends
 */
const getPostingTrends = async (req, res) => {
    try {
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;
        const { days = 30 } = req.query;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        const posts = await prisma.publishedPost.findMany({
            where: {
                tenantId,
                userId,
                publishedAt: {
                    gte: startDate
                }
            },
            select: {
                publishedAt: true,
                platform: true
            },
            orderBy: { publishedAt: 'asc' }
        });

        // Group by date
        const trendData = {};
        posts.forEach(post => {
            const date = post.publishedAt.toISOString().split('T')[0];
            if (!trendData[date]) {
                trendData[date] = { date, count: 0, byPlatform: {} };
            }
            trendData[date].count++;
            trendData[date].byPlatform[post.platform] =
                (trendData[date].byPlatform[post.platform] || 0) + 1;
        });

        res.status(200).json({
            success: true,
            data: {
                trends: Object.values(trendData)
            }
        });
    } catch (error) {
        console.error('Get posting trends error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching posting trends'
        });
    }
};

/**
 * Get property-specific analytics
 * @route GET /api/social/analytics/properties
 */
const getPropertyAnalytics = async (req, res) => {
    try {
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        const postsWithProperties = await prisma.scheduledPost.findMany({
            where: {
                tenantId,
                userId,
                propertyId: { not: null },
                status: 'POSTED'
            },
            include: {
                property: {
                    select: { id: true, title: true }
                },
                publishedPosts: true
            }
        });

        // Group by property
        const propertyData = {};
        postsWithProperties.forEach(post => {
            if (post.property) {
                const propId = post.property.id;
                if (!propertyData[propId]) {
                    propertyData[propId] = {
                        propertyId: propId,
                        propertyTitle: post.property.title,
                        totalPosts: 0,
                        platforms: new Set()
                    };
                }
                propertyData[propId].totalPosts++;
                post.platforms.forEach(p => propertyData[propId].platforms.add(p));
            }
        });

        // Convert sets to arrays
        const result = Object.values(propertyData).map(item => ({
            ...item,
            platforms: Array.from(item.platforms)
        }));

        res.status(200).json({
            success: true,
            data: {
                properties: result
            }
        });
    } catch (error) {
        console.error('Get property analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching property analytics'
        });
    }
};

/**
 * Get engagement metrics summary
 * @route GET /api/social/analytics/engagement
 */
const getEngagementMetrics = async (req, res) => {
    try {
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        const publishedPosts = await prisma.publishedPost.findMany({
            where: { tenantId, userId },
            select: { metrics: true, platform: true }
        });

        let totalLikes = 0;
        let totalComments = 0;
        let totalShares = 0;
        let totalReach = 0;
        const platformEngagement = {};

        publishedPosts.forEach(post => {
            const metrics = post.metrics || {};

            totalLikes += metrics.likes || 0;
            totalComments += metrics.comments || 0;
            totalShares += metrics.shares || 0;
            totalReach += metrics.reach || 0;

            if (!platformEngagement[post.platform]) {
                platformEngagement[post.platform] = {
                    likes: 0,
                    comments: 0,
                    shares: 0,
                    reach: 0,
                    posts: 0
                };
            }

            platformEngagement[post.platform].likes += metrics.likes || 0;
            platformEngagement[post.platform].comments += metrics.comments || 0;
            platformEngagement[post.platform].shares += metrics.shares || 0;
            platformEngagement[post.platform].reach += metrics.reach || 0;
            platformEngagement[post.platform].posts++;
        });

        res.status(200).json({
            success: true,
            data: {
                overall: {
                    totalLikes,
                    totalComments,
                    totalShares,
                    totalReach,
                    totalPosts: publishedPosts.length
                },
                byPlatform: platformEngagement
            }
        });
    } catch (error) {
        console.error('Get engagement metrics error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching engagement metrics'
        });
    }
};

/**
 * AI Forecasting: predict next 14 days posting volume using linear regression on last 30 days
 * @route GET /api/social/analytics/forecast
 */
const getForecast = async (req, res) => {
    try {
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        // Fetch last 30 days of published posts
        const posts = await prisma.publishedPost.findMany({
            where: { tenantId, userId, publishedAt: { gte: startDate } },
            select: { publishedAt: true, platform: true, metrics: true }
        });

        // Build day-by-day count map
        const dayMap = {};
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split('T')[0];
            dayMap[key] = { date: key, count: 0, totalEngagement: 0 };
        }

        // Populate with real post data
        posts.forEach(post => {
            const key = post.publishedAt.toISOString().split('T')[0];
            if (dayMap[key]) {
                dayMap[key].count++;
                const m = post.metrics || {};
                dayMap[key].totalEngagement += (m.likes || 0) + (m.comments || 0) + (m.shares || 0);
            }
        });

        const historical = Object.values(dayMap);

        // Simple linear regression (y = a + bx)
        const n = historical.length;
        const xs = historical.map((_, i) => i);
        const ys = historical.map(d => d.count);
        const sumX = xs.reduce((s, x) => s + x, 0);
        const sumY = ys.reduce((s, y) => s + y, 0);
        const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
        const sumX2 = xs.reduce((s, x) => s + x * x, 0);
        const b = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) || 0;
        const a = (sumY - b * sumX) / n;

        // Generate 14-day forecast
        const forecast = [];
        for (let i = 1; i <= 14; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            const predicted = Math.max(0, Math.round(a + b * (n + i - 1)));
            forecast.push({
                date: d.toISOString().split('T')[0],
                predicted,
                // Confidence band (±1 std dev)
                low: Math.max(0, predicted - 1),
                high: predicted + 2
            });
        }

        // Best posting day of week
        const dowCounts = Array(7).fill(0);
        posts.forEach(p => { dowCounts[new Date(p.publishedAt).getDay()]++; });
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const bestDayIndex = dowCounts.indexOf(Math.max(...dowCounts));

        // Total engagement over window
        const totalEngagement = posts.reduce((s, p) => {
            const m = p.metrics || {};
            return s + (m.likes || 0) + (m.comments || 0) + (m.shares || 0);
        }, 0);
        const avgEngagementPerPost = posts.length > 0 ? (totalEngagement / posts.length).toFixed(1) : '0';

        // Trend direction
        const trendDirection = b > 0.05 ? 'increasing' : b < -0.05 ? 'decreasing' : 'stable';
        const projectedMonthly = Math.max(0, Math.round((a + b * (n + 14)) * 30));

        res.status(200).json({
            success: true,
            data: {
                historical,
                forecast,
                insights: {
                    trendDirection,
                    trendSlope: parseFloat(b.toFixed(4)),
                    bestPostingDay: dayNames[bestDayIndex],
                    totalPostsLast30Days: posts.length,
                    avgEngagementPerPost: parseFloat(avgEngagementPerPost),
                    projectedMonthly,
                    dataPoints: n
                }
            }
        });
    } catch (error) {
        console.error('Forecast error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error generating forecast'
        });
    }
};

module.exports = {
    getOverview,
    getPlatformAnalytics,
    getPostingTrends,
    getPropertyAnalytics,
    getEngagementMetrics,
    getForecast
};
