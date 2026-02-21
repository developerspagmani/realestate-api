const { prisma } = require('../../config/database');
const ScheduledPostsService = require('../../services/social/scheduledPostsService');

const scheduledPostsService = new ScheduledPostsService();

/**
 * Create a new scheduled post
 * @route POST /api/social/posts/scheduled
 */
const createScheduledPost = async (req, res) => {
    try {
        const {
            title,
            description,
            hashtags,
            platforms,
            scheduledDate,
            scheduledTime,
            propertyId,
            isVideo,
            isCarousel,
            mediaUrls,
            imageData,
            videoData,
            status
        } = req.body;

        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        // Validate required fields
        if (!title || !platforms || !scheduledDate || !scheduledTime) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: title, platforms, scheduledDate, scheduledTime'
            });
        }

        const post = await prisma.scheduledPost.create({
            data: {
                tenantId,
                userId,
                propertyId: propertyId || null,
                title,
                description,
                hashtags,
                platforms: platforms.map(p => p.toUpperCase()),
                scheduledDate: new Date(scheduledDate),
                scheduledTime,
                status: status || 'SCHEDULED',
                isVideo: isVideo || false,
                isCarousel: isCarousel || false,
                mediaUrls: mediaUrls || [],
                imageData: imageData || null,
                videoData: videoData || null
            },
            include: {
                property: true,
                user: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        // Trigger immediate publishing if requested
        if (status === 'POSTED') {
            try {
                await scheduledPostsService.publishNow(post.id, userId, tenantId);
            } catch (publishError) {
                console.error('Initial publish attempt failed:', publishError);
                // We still return 201 because the post was created, 
                // but we might want to inform the user about the publishing failure
                return res.status(201).json({
                    success: true,
                    message: 'Post created but initial publishing failed',
                    error: publishError.message,
                    data: { post }
                });
            }
        }

        res.status(201).json({
            success: true,
            message: status === 'POSTED' ? 'Post published successfully' : 'Post scheduled successfully',
            data: { post }
        });
    } catch (error) {
        console.error('Create scheduled post error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error creating scheduled post'
        });
    }
};

/**
 * Create a draft post
 * @route POST /api/social/posts/drafts
 */
const createDraft = async (req, res) => {
    try {
        const {
            title,
            description,
            hashtags,
            platforms,
            propertyId,
            isVideo,
            isCarousel,
            mediaUrls,
            imageData,
            videoData
        } = req.body;

        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        if (!title || !platforms) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: title, platforms'
            });
        }

        const draft = await prisma.scheduledPost.create({
            data: {
                tenantId,
                userId,
                propertyId: propertyId || null,
                title,
                description,
                hashtags,
                platforms: Array.isArray(platforms) ? platforms.map(p => p.toUpperCase()) : [],
                scheduledDate: new Date(), // Placeholder date
                scheduledTime: '00:00',
                status: 'DRAFT',
                isVideo: isVideo || false,
                isCarousel: isCarousel || false,
                mediaUrls: mediaUrls || [],
                imageData: imageData || null,
                videoData: videoData || null
            },
            include: {
                property: true
            }
        });

        res.status(201).json({
            success: true,
            message: 'Draft created successfully',
            data: { draft }
        });
    } catch (error) {
        console.error('Create draft error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating draft'
        });
    }
};

/**
 * Get all scheduled posts
 * @route GET /api/social/posts/scheduled
 */
const getScheduledPosts = async (req, res) => {
    try {
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;
        const { status, platform, propertyId, page = 1, limit = 20 } = req.query;

        const where = {
            tenantId,
            userId,
            status: { not: 'DRAFT' }
        };

        if (status) {
            where.status = status.toUpperCase();
        }

        if (platform) {
            where.platforms = { has: platform.toUpperCase() };
        }

        if (propertyId) {
            where.propertyId = propertyId;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const [posts, total] = await Promise.all([
            prisma.scheduledPost.findMany({
                where,
                include: {
                    property: true,
                    user: {
                        select: { id: true, name: true, email: true }
                    },
                    publishedPosts: true
                },
                orderBy: { scheduledDate: 'asc' },
                skip,
                take
            }),
            prisma.scheduledPost.count({ where })
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
        console.error('Get scheduled posts error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching scheduled posts'
        });
    }
};

/**
 * Get all drafts
 * @route GET /api/social/posts/drafts
 */
const getDrafts = async (req, res) => {
    try {
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;
        const { page = 1, limit = 20 } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const [drafts, total] = await Promise.all([
            prisma.scheduledPost.findMany({
                where: {
                    tenantId,
                    userId,
                    status: 'DRAFT'
                },
                include: {
                    property: true
                },
                orderBy: { updatedAt: 'desc' },
                skip,
                take
            }),
            prisma.scheduledPost.count({
                where: { tenantId, userId, status: 'DRAFT' }
            })
        ]);

        res.status(200).json({
            success: true,
            data: { drafts },
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get drafts error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching drafts'
        });
    }
};

/**
 * Get a specific scheduled post
 * @route GET /api/social/posts/scheduled/:id
 */
const getScheduledPostById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        const post = await prisma.scheduledPost.findFirst({
            where: { id, userId, tenantId },
            include: {
                property: true,
                user: {
                    select: { id: true, name: true, email: true }
                },
                publishedPosts: true
            }
        });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Scheduled post not found'
            });
        }

        res.status(200).json({
            success: true,
            data: { post }
        });
    } catch (error) {
        console.error('Get scheduled post error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching scheduled post'
        });
    }
};

/**
 * Update a scheduled post
 * @route PUT /api/social/posts/scheduled/:id
 */
const updateScheduledPost = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        // Check if post exists and belongs to user
        const existingPost = await prisma.scheduledPost.findFirst({
            where: { id, userId, tenantId }
        });

        if (!existingPost) {
            return res.status(404).json({
                success: false,
                message: 'Scheduled post not found'
            });
        }

        const {
            title,
            description,
            hashtags,
            platforms,
            scheduledDate,
            scheduledTime,
            propertyId,
            mediaUrls,
            imageData,
            videoData
        } = req.body;

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (hashtags !== undefined) updateData.hashtags = hashtags;
        if (platforms !== undefined) updateData.platforms = platforms.map(p => p.toUpperCase());
        if (scheduledDate !== undefined) updateData.scheduledDate = new Date(scheduledDate);
        if (scheduledTime !== undefined) updateData.scheduledTime = scheduledTime;
        if (propertyId !== undefined) updateData.propertyId = propertyId;
        if (mediaUrls !== undefined) updateData.mediaUrls = mediaUrls;
        if (imageData !== undefined) updateData.imageData = imageData;
        if (videoData !== undefined) updateData.videoData = videoData;

        const post = await prisma.scheduledPost.update({
            where: { id },
            data: updateData,
            include: {
                property: true,
                publishedPosts: true
            }
        });

        res.status(200).json({
            success: true,
            message: 'Post updated successfully',
            data: { post }
        });
    } catch (error) {
        console.error('Update scheduled post error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating scheduled post'
        });
    }
};

/**
 * Delete a scheduled post
 * @route DELETE /api/social/posts/scheduled/:id
 */
const deleteScheduledPost = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        const post = await prisma.scheduledPost.findFirst({
            where: { id, userId, tenantId }
        });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Scheduled post not found'
            });
        }

        await prisma.scheduledPost.delete({
            where: { id }
        });

        res.status(200).json({
            success: true,
            message: 'Post deleted successfully'
        });
    } catch (error) {
        console.error('Delete scheduled post error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error deleting scheduled post'
        });
    }
};

/**
 * Publish a post immediately
 * @route POST /api/social/posts/scheduled/:id/publish
 */
const publishNow = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        const result = await scheduledPostsService.publishNow(id, userId, tenantId);

        res.status(200).json({
            success: true,
            message: 'Post published successfully',
            data: result
        });
    } catch (error) {
        console.error('Publish now error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error publishing post'
        });
    }
};

/**
 * Get scheduled posts statistics
 * @route GET /api/social/posts/scheduled/stats
 */
const getStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        const [total, scheduled, posted, failed, drafts] = await Promise.all([
            prisma.scheduledPost.count({ where: { userId, tenantId } }),
            prisma.scheduledPost.count({ where: { userId, tenantId, status: 'SCHEDULED' } }),
            prisma.scheduledPost.count({ where: { userId, tenantId, status: 'POSTED' } }),
            prisma.scheduledPost.count({ where: { userId, tenantId, status: 'FAILED' } }),
            prisma.scheduledPost.count({ where: { userId, tenantId, status: 'DRAFT' } })
        ]);

        res.status(200).json({
            success: true,
            data: {
                total,
                scheduled,
                posted,
                failed,
                drafts
            }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching stats'
        });
    }
};

/**
 * Get posts by property ID
 * @route GET /api/social/posts/scheduled/property/:propertyId
 */
const getPostsByProperty = async (req, res) => {
    try {
        const { propertyId } = req.params;
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        const posts = await prisma.scheduledPost.findMany({
            where: {
                tenantId,
                userId,
                propertyId
            },
            include: {
                property: true,
                publishedPosts: true
            },
            orderBy: { scheduledDate: 'desc' }
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

module.exports = {
    createScheduledPost,
    createDraft,
    getScheduledPosts,
    getDrafts,
    getScheduledPostById,
    updateScheduledPost,
    deleteScheduledPost,
    publishNow,
    getStats,
    getPostsByProperty
};
