const { prisma } = require('../config/database');

// Get all campaigns
const getAllCampaigns = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
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
    const where = { tenantId };

    if (status) where.status = parseInt(status);

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        include: {
          template: true,
          group: true
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: parseInt(limit),
      }),
      prisma.campaign.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: campaigns,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
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
    const tenantId = req.tenant?.id;

    const campaign = await prisma.campaign.findFirst({
      where: { id, tenantId },
      include: {
        template: true,
        group: true,
        logs: {
          take: 10,
          orderBy: { occurredAt: 'desc' }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    res.status(200).json({
      success: true,
      data: campaign
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
    const tenantId = req.tenant?.id;
    const {
      name,
      templateId,
      groupId,
      scheduledAt,
      status = 1
    } = req.body;

    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const campaign = await prisma.campaign.create({
      data: {
        name,
        templateId,
        groupId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: parseInt(status),
        tenantId,
      },
      include: {
        template: true,
        group: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Campaign created successfully',
      data: campaign
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
    const tenantId = req.tenant?.id;
    const {
      name,
      templateId,
      groupId,
      scheduledAt,
      status
    } = req.body;

    const campaign = await prisma.campaign.updateMany({
      where: { id, tenantId },
      data: {
        ...(name && { name }),
        ...(templateId && { templateId }),
        ...(groupId && { groupId }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
        ...(status !== undefined && { status: parseInt(status) }),
        updatedAt: new Date()
      }
    });

    if (campaign.count === 0) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Campaign updated successfully'
    });
  } catch (error) {
    console.error('Update campaign error:', error);
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
    const tenantId = req.tenant?.id;

    await prisma.campaign.deleteMany({
      where: { id, tenantId }
    });

    res.status(200).json({
      success: true,
      message: 'Campaign deleted successfully'
    });
  } catch (error) {
    console.error('Delete campaign error:', error);
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
    const tenantId = req.tenant?.id;

    const campaign = await prisma.campaign.updateMany({
      where: { id, tenantId },
      data: {
        status: 4, // Sent
        sentAt: new Date(),
        updatedAt: new Date()
      }
    });

    if (campaign.count === 0) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Campaign launched successfully'
    });
  } catch (error) {
    console.error('Launch campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error launching campaign'
    });
  }
};

// Get campaign statistics
const getCampaignStats = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const [
      totalCampaigns,
      sentCampaigns,
      draftCampaigns,
      stats,
      totalSubmissions
    ] = await Promise.all([
      prisma.campaign.count({ where: { tenantId } }),
      prisma.campaign.count({ where: { tenantId, status: 4 } }),
      prisma.campaign.count({ where: { tenantId, status: 1 } }),
      prisma.campaign.aggregate({
        where: { tenantId },
        _sum: {
          deliveredCount: true,
          openedCount: true,
          clickedCount: true
        }
      }),
      prisma.lead.count({ where: { tenantId, source: 1 } })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalCampaigns,
        sentCampaigns,
        draftCampaigns,
        totalDelivered: stats._sum.deliveredCount || 0,
        totalOpened: stats._sum.openedCount || 0,
        totalClicked: stats._sum.clickedCount || 0,
        totalSubmissions: totalSubmissions || 0
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
