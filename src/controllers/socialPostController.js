const { prisma } = require('../config/database');

// Get all social posts
const getAllSocialPosts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      platform,
      status,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const tenantId = req.tenant?.id;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }

    const skip = (page - 1) * limit;

    // Build where clause
    const where = { tenantId };  // Added: tenant filtering
    
    if (platform) where.platform = platform.toLowerCase();
    if (status) where.status = parseInt(status);  // Fixed: was string
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [socialPosts, total] = await Promise.all([
      prisma.socialPost.findMany({
        where,
        include: {
          createdByUser: {
            select: {
              id: true,
              name: true,    // Fixed: was firstName/lastName
              email: true,
            }
          },
          media: {
            select: {
              id: true,
              url: true,
              alt: true,
              type: true,
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: parseInt(limit),
      }),
      prisma.socialPost.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        socialPosts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        }
      }
    });
  } catch (error) {
    console.error('Get all social posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching social posts'
    });
  }
};

// Get social post by ID
const getSocialPostById = async (req, res) => {
  try {
    const { id } = req.params;

    const socialPost = await prisma.socialPost.findUnique({
      where: { id },
      include: {
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        },
        media: {
          select: {
            id: true,
            url: true,
            alt: true,
            type: true,
            filename: true,
          }
        }
      }
    });

    if (!socialPost) {
      return res.status(404).json({
        success: false,
        message: 'Social post not found'
      });
    }

    // Check permissions
    if (req.user.role === 'OWNER' && socialPost.createdBy !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: { socialPost }
    });
  } catch (error) {
    console.error('Get social post error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching social post'
    });
  }
};

// Create social post
const createSocialPost = async (req, res) => {
  try {
    const {
      content,
      platform,
      mediaIds,
      scheduledDate,
      status = 'DRAFT',
      hashtags,
      mentions
    } = req.body;

    const socialPost = await prisma.socialPost.create({
      data: {
        content,
        platform: platform.toLowerCase(),
        mediaIds: mediaIds || [],
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        status: status.toUpperCase(),
        hashtags: hashtags || [],
        mentions: mentions || [],
        createdBy: req.user.id,
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        },
        media: {
          select: {
            id: true,
            url: true,
            alt: true,
            type: true,
            filename: true,
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Social post created successfully',
      data: { socialPost }
    });
  } catch (error) {
    console.error('Create social post error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating social post'
    });
  }
};

// Update social post
const updateSocialPost = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      content,
      platform,
      mediaIds,
      scheduledDate,
      status,
      hashtags,
      mentions
    } = req.body;

    // Check if social post exists and permissions
    const existingPost = await prisma.socialPost.findUnique({
      where: { id }
    });

    if (!existingPost) {
      return res.status(404).json({
        success: false,
        message: 'Social post not found'
      });
    }

    if (req.user.role === 'OWNER' && existingPost.createdBy !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const socialPost = await prisma.socialPost.update({
      where: { id },
      data: {
        ...(content && { content }),
        ...(platform && { platform: platform.toLowerCase() }),
        ...(mediaIds && { mediaIds }),
        ...(scheduledDate && { scheduledDate: new Date(scheduledDate) }),
        ...(status && { status: status.toUpperCase() }),
        ...(hashtags && { hashtags }),
        ...(mentions && { mentions }),
        updatedAt: new Date()
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        },
        media: {
          select: {
            id: true,
            url: true,
            alt: true,
            type: true,
            filename: true,
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Social post updated successfully',
      data: { socialPost }
    });
  } catch (error) {
    console.error('Update social post error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Social post not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error updating social post'
    });
  }
};

// Delete social post
const deleteSocialPost = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if social post exists and permissions
    const existingPost = await prisma.socialPost.findUnique({
      where: { id }
    });

    if (!existingPost) {
      return res.status(404).json({
        success: false,
        message: 'Social post not found'
      });
    }

    if (req.user.role === 'OWNER' && existingPost.createdBy !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await prisma.socialPost.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Social post deleted successfully'
    });
  } catch (error) {
    console.error('Delete social post error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Social post not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error deleting social post'
    });
  }
};

// Publish social post
const publishSocialPost = async (req, res) => {
  try {
    const { id } = req.params;

    const socialPost = await prisma.socialPost.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        },
        media: {
          select: {
            id: true,
            url: true,
            alt: true,
            type: true,
            filename: true,
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Social post published successfully',
      data: { socialPost }
    });
  } catch (error) {
    console.error('Publish social post error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Social post not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error publishing social post'
    });
  }
};

// Get social media statistics
const getSocialMediaStats = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    let dateFilter;
    const now = new Date();
    
    switch (period) {
      case 'day':
        dateFilter = {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate())
        };
        break;
      case 'week':
        dateFilter = {
          gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        };
        break;
      case 'month':
        dateFilter = {
          gte: new Date(now.getFullYear(), now.getMonth(), 1)
        };
        break;
      case 'year':
        dateFilter = {
          gte: new Date(now.getFullYear(), 0, 1)
        };
        break;
    }

    // Build where clause for owners
    const where = {
      createdAt: dateFilter
    };

    if (req.user.role === 'OWNER') {
      where.createdBy = req.user.id;
    }

    const [
      totalPosts,
      publishedPosts,
      draftPosts,
      scheduledPosts,
      postsByPlatform,
      engagementStats
    ] = await Promise.all([
      prisma.socialPost.count({ where }),
      prisma.socialPost.count({ where: { ...where, status: 'PUBLISHED' } }),
      prisma.socialPost.count({ where: { ...where, status: 'DRAFT' } }),
      prisma.socialPost.count({ where: { ...where, status: 'SCHEDULED' } }),
      prisma.socialPost.groupBy({
        by: ['platform'],
        where,
        _count: { id: true }
      }),
      // This would be enhanced with actual engagement data from social media APIs
      prisma.socialPost.aggregate({
        where: { ...where, status: 'PUBLISHED' },
        _avg: { likes: true, shares: true, comments: true },
        _sum: { likes: true, shares: true, comments: true }
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalPosts,
        publishedPosts,
        draftPosts,
        scheduledPosts,
        postsByPlatform,
        engagementStats: {
          totalLikes: engagementStats._sum.likes || 0,
          totalShares: engagementStats._sum.shares || 0,
          totalComments: engagementStats._sum.comments || 0,
          avgLikes: engagementStats._avg.likes || 0,
          avgShares: engagementStats._avg.shares || 0,
          avgComments: engagementStats._avg.comments || 0,
        },
        period
      }
    });
  } catch (error) {
    console.error('Get social media stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching social media statistics'
    });
  }
};

module.exports = {
  getAllSocialPosts,
  getSocialPostById,
  createSocialPost,
  updateSocialPost,
  deleteSocialPost,
  publishSocialPost,
  getSocialMediaStats,
};
