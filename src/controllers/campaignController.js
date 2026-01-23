const { prisma } = require('../config/database');

// Get all campaigns
const getAllCampaigns = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      type,
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
    
    if (status) where.status = parseInt(status);  // Fixed: was string
    if (type) where.type = type.toLowerCase();
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        include: {
          createdByUser: {
            select: {
              id: true,
              name: true,    // Fixed: was firstName/lastName
              email: true,
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: parseInt(limit),
      }),
      prisma.campaign.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        campaigns,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        }
      }
    });
  } catch (error) {
    console.error('Get all campaigns error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching campaigns'
    });
  }
};

// Get campaign by ID
const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Check permissions
    if (req.user.role === 'OWNER' && campaign.createdBy !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: { campaign }
    });
  } catch (error) {
    console.error('Get campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching campaign'
    });
  }
};

// Create campaign
const createCampaign = async (req, res) => {
  try {
    const {
      name,
      type,
      subject,
      content,
      targetAudience,
      scheduledDate,
      status = 'DRAFT'
    } = req.body;

    const campaign = await prisma.campaign.create({
      data: {
        name,
        type: type.toLowerCase(),
        subject,
        content,
        targetAudience: targetAudience || [],
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        status: status.toUpperCase(),
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
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Campaign created successfully',
      data: { campaign }
    });
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating campaign'
    });
  }
};

// Update campaign
const updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      type,
      subject,
      content,
      targetAudience,
      scheduledDate,
      status
    } = req.body;

    // Check if campaign exists and permissions
    const existingCampaign = await prisma.campaign.findUnique({
      where: { id }
    });

    if (!existingCampaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    if (req.user.role === 'OWNER' && existingCampaign.createdBy !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(type && { type: type.toLowerCase() }),
        ...(subject && { subject }),
        ...(content && { content }),
        ...(targetAudience && { targetAudience }),
        ...(scheduledDate && { scheduledDate: new Date(scheduledDate) }),
        ...(status && { status: status.toUpperCase() }),
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
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Campaign updated successfully',
      data: { campaign }
    });
  } catch (error) {
    console.error('Update campaign error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error updating campaign'
    });
  }
};

// Delete campaign
const deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if campaign exists and permissions
    const existingCampaign = await prisma.campaign.findUnique({
      where: { id }
    });

    if (!existingCampaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    if (req.user.role === 'OWNER' && existingCampaign.createdBy !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await prisma.campaign.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Campaign deleted successfully'
    });
  } catch (error) {
    console.error('Delete campaign error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error deleting campaign'
    });
  }
};

// Launch campaign
const launchCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        launchedAt: new Date(),
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
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Campaign launched successfully',
      data: { campaign }
    });
  } catch (error) {
    console.error('Launch campaign error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error launching campaign'
    });
  }
};

// Get campaign statistics
const getCampaignStats = async (req, res) => {
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
      totalCampaigns,
      activeCampaigns,
      completedCampaigns,
      campaignsByType,
      campaignsByStatus
    ] = await Promise.all([
      prisma.campaign.count({ where }),
      prisma.campaign.count({ where: { ...where, status: 'ACTIVE' } }),
      prisma.campaign.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.campaign.groupBy({
        by: ['type'],
        where,
        _count: { id: true }
      }),
      prisma.campaign.groupBy({
        by: ['status'],
        where,
        _count: { id: true }
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalCampaigns,
        activeCampaigns,
        completedCampaigns,
        campaignsByType,
        campaignsByStatus,
        period
      }
    });
  } catch (error) {
    console.error('Get campaign stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching campaign statistics'
    });
  }
};

module.exports = {
  getAllCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  launchCampaign,
  getCampaignStats,
};
