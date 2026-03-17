const { prisma } = require('../../config/database');
const ScheduledPostsService = require('../../services/social/scheduledPostsService');
const scheduledPostsService = new ScheduledPostsService();

/**
 * Get all published posts
 * @route GET /api/social/posts/published
 */
const getPublishedPosts = async (req, res) => {
    try {
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;
        const { platform, propertyId, page = 1, limit = 20 } = req.query;

        const where = { tenantId, userId };

        if (platform) {
            where.platform = platform.toUpperCase();
        }

        if (propertyId) {
            where.scheduledPost = { propertyId };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const [posts, total] = await Promise.all([
            prisma.publishedPost.findMany({
                where,
                include: {
                    scheduledPost: {
                        include: {
                            property: true
                        }
                    },
                    user: {
                        select: { id: true, name: true, email: true }
                    }
                },
                orderBy: { publishedAt: 'desc' },
                skip,
                take
            }),
            prisma.publishedPost.count({ where })
        ]);

        res.status(200).json({
            success: true,
            data: { posts },
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get published posts error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching published posts'
        });
    }
};

/**
 * Get a specific published post
 * @route GET /api/social/posts/published/:id
 */
const getPublishedPostById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        const post = await prisma.publishedPost.findFirst({
            where: { id, userId, tenantId },
            include: {
                scheduledPost: {
                    include: {
                        property: true
                    }
                },
                user: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Published post not found'
            });
        }

        res.status(200).json({
            success: true,
            data: { post }
        });
    } catch (error) {
        console.error('Get published post error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching published post'
        });
    }
};

/**
 * Update post metrics (likes, comments, shares, etc.)
 * @route PUT /api/social/posts/published/:id/metrics
 */
const updateMetrics = async (req, res) => {
    try {
        const { id } = req.params;
        const { metrics } = req.body;
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        const post = await prisma.publishedPost.findFirst({
            where: { id, userId, tenantId }
        });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Published post not found'
            });
        }

        const updatedPost = await prisma.publishedPost.update({
            where: { id },
            data: {
                metrics: metrics || {},
                updatedAt: new Date()
            }
        });

        res.status(200).json({
            success: true,
            message: 'Metrics updated successfully',
            data: { post: updatedPost }
        });
    } catch (error) {
        console.error('Update metrics error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating metrics'
        });
    }
};

/**
 * Get published posts statistics
 * @route GET /api/social/posts/published/stats
 */
const getPublishedStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        const [total, byPlatform, recent] = await Promise.all([
            prisma.publishedPost.count({ where: { userId, tenantId } }),
            prisma.publishedPost.groupBy({
                by: ['platform'],
                where: { userId, tenantId },
                _count: { id: true }
            }),
            prisma.publishedPost.findMany({
                where: { userId, tenantId },
                orderBy: { publishedAt: 'desc' },
                take: 5,
                include: {
                    scheduledPost: {
                        select: { title: true }
                    }
                }
            })
        ]);

        const platformStats = byPlatform.reduce((acc, item) => {
            acc[item.platform] = item._count.id;
            return acc;
        }, {});

        res.status(200).json({
            success: true,
            data: {
                total,
                byPlatform: platformStats,
                recentPosts: recent
            }
        });
    } catch (error) {
        console.error('Get published stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching statistics'
        });
    }
};

/**
 * Delete a published post record
 * @route DELETE /api/social/posts/published/:id
 */
const deletePublishedPost = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        const post = await prisma.publishedPost.findFirst({
            where: { id, userId, tenantId }
        });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Published post not found'
            });
        }

        await prisma.publishedPost.delete({
            where: { id }
        });

        res.status(200).json({
            success: true,
            message: 'Published post record deleted successfully'
        });
    } catch (error) {
        console.error('Delete published post error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error deleting published post'
        });
    }
};

/**
 * Get posts by property
 * @route GET /api/social/posts/published/property/:propertyId
 */
const getPublishedPostsByProperty = async (req, res) => {
    try {
        const { propertyId } = req.params;
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        const posts = await prisma.publishedPost.findMany({
            where: {
                tenantId,
                userId,
                scheduledPost: {
                    propertyId
                }
            },
            include: {
                scheduledPost: {
                    include: {
                        property: true
                    }
                }
            },
            orderBy: { publishedAt: 'desc' }
        });

        res.status(200).json({
            success: true,
            data: { posts }
        });
    } catch (error) {
        console.error('Get posts by property error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching posts'
        });
    }
};

/**
 * Refresh post metrics from the social platform
 * @route POST /api/social/posts/published/:id/refresh
 */
const refreshPostMetrics = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        // Get the published post with connected account
        const post = await prisma.publishedPost.findFirst({
            where: { id, userId, tenantId }
        });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Published post not found'
            });
        }

        // Get the connected account for this platform
        const account = await prisma.connectedAccount.findFirst({
            where: {
                userId,
                tenantId,
                platform: post.platform,
                isActive: true
            }
        });

        if (!account) {
            return res.status(400).json({
                success: false,
                message: `No active ${post.platform} account found to refresh metrics`
            });
        }

        let newMetrics = {};

        // Fetch metrics based on platform
        switch (post.platform) {
            case 'FACEBOOK':
                newMetrics = await scheduledPostsService.getFacebookMetrics(post.platformPostId, account);
                break;
            case 'INSTAGRAM':
                newMetrics = await scheduledPostsService.getInstagramMetrics(post.platformPostId, account);
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: `Refreshing metrics for ${post.platform} is not supported yet`
                });
        }

        // Update the post metrics in database
        const updatedPost = await prisma.publishedPost.update({
            where: { id },
            data: {
                metrics: newMetrics,
                updatedAt: new Date()
            }
        });

        res.status(200).json({
            success: true,
            message: 'Metrics refreshed successfully',
            data: { metrics: newMetrics, post: updatedPost }
        });
    } catch (error) {
        console.error('Refresh metrics error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error refreshing metrics'
        });
    }
};

/**
 * Get detailed engagement for a published post (real-time from platform)
 * @route GET /api/social/posts/published/:id/engagement
 */
const getPostEngagementDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        const post = await prisma.publishedPost.findFirst({
            where: { id, userId, tenantId }
        });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Published post not found'
            });
        }

        const account = await prisma.connectedAccount.findFirst({
            where: {
                userId,
                tenantId,
                platform: post.platform,
                isActive: true
            }
        });

        if (!account) {
            return res.status(400).json({
                success: false,
                message: `No active ${post.platform} account found to fetch engagement`
            });
        }

        let engagement = { 
            summary: post.metrics || { likes: 0, comments: 0, shares: 0, reach: 0 }, 
            comments: [] 
        };

        if (post.platform === 'FACEBOOK') {
            engagement = await scheduledPostsService.getFacebookDetailedEngagement(post.platformPostId, account);
            
            // Optionally update metrics in background
            prisma.publishedPost.update({
                where: { id },
                data: { metrics: engagement.summary }
            }).catch(e => console.error('Failed to update Facebook metrics in background:', e));
        } else if (post.platform === 'INSTAGRAM') {
            engagement = await scheduledPostsService.getInstagramDetailedEngagement(post.platformPostId, account);

            // Optionally update metrics in background
            prisma.publishedPost.update({
                where: { id },
                data: { metrics: engagement.summary }
            }).catch(e => console.error('Failed to update Instagram metrics in background:', e));
        }

        res.status(200).json({
            success: true,
            data: engagement
        });
    } catch (error) {
        console.error('Get post engagement details error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error fetching engagement details'
        });
    }
};

module.exports = {
    getPublishedPosts,
    getPublishedPostById,
    updateMetrics,
    refreshPostMetrics,
    getPublishedStats,
    deletePublishedPost,
    getPublishedPostsByProperty,
    getPostEngagementDetails
};
