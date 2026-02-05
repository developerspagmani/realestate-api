const { prisma } = require('../config/database');

// Get all campaigns
const getAllCampaigns = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const campaigns = await prisma.campaign.findMany({
      where: { tenantId },
      include: {
        template: {
          select: { id: true, name: true, subject: true }
        },
        group: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ success: true, data: campaigns });
  } catch (error) {
    console.error('Get all campaigns error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching campaigns' });
  }
};

// Create campaign
const createCampaign = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    const { name, templateId, groupId, scheduledAt } = req.body;

    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const campaign = await prisma.campaign.create({
      data: {
        name,
        templateId,
        groupId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: 1, // Draft
        tenantId
      }
    });

    res.status(201).json({ success: true, message: 'Campaign created successfully', data: campaign });
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({ success: false, message: 'Server error creating campaign' });
  }
};

// Update campaign
const updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant?.id;
    const { name, templateId, groupId, scheduledAt, status } = req.body;

    const campaign = await prisma.campaign.updateMany({
      where: { id, tenantId },
      data: {
        ...(name && { name }),
        ...(templateId && { templateId }),
        ...(groupId && { groupId }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
        ...(status && { status: parseInt(status) }),
        updatedAt: new Date()
      }
    });

    if (campaign.count === 0) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    res.status(200).json({ success: true, message: 'Campaign updated successfully' });
  } catch (error) {
    console.error('Update campaign error:', error);
    res.status(500).json({ success: false, message: 'Server error updating campaign' });
  }
};

// Delete campaign
const deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant?.id;

    const campaign = await prisma.campaign.deleteMany({
      where: { id, tenantId }
    });

    if (campaign.count === 0) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    res.status(200).json({ success: true, message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting campaign' });
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
        group: {
          include: {
            leads: true
          }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    res.status(200).json({ success: true, data: campaign });
  } catch (error) {
    console.error('Get campaign by ID error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching campaign' });
  }
};

// Launch campaign
const launchCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant?.id;

    const campaignRecord = await prisma.campaign.findFirst({
      where: { id, tenantId },
      include: {
        group: {
          include: {
            leads: true
          }
        },
        template: true
      }
    });

    if (!campaignRecord) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    if (campaignRecord.status === 4) {
      return res.status(400).json({ success: false, message: 'Campaign already launched' });
    }

    // Actual email sending logic
    let deliveredCount = 0;
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:3001';

    if (campaignRecord.group && campaignRecord.template) {
      const { sendTemplateEmail } = require('../utils/emailService');
      const leads = campaignRecord.group.leads || [];
      console.log(`[Campaign Launch] Starting launch for "${campaignRecord.name}". Found ${leads.length} leads.`);

      for (const lead of leads) {
        if (lead.email) {
          let customizedContent = campaignRecord.template.content;
          let subject = campaignRecord.template.subject || campaignRecord.name;

          // 1. Personalization
          if (lead.name) {
            customizedContent = customizedContent.replace(/{{name}}/gi, lead.name);
            subject = subject.replace(/{{name}}/gi, lead.name);
          } else {
            customizedContent = customizedContent.replace(/{{name}}/gi, 'Valued Client');
          }

          // 2. Click Tracking (Wrap Links)
          customizedContent = customizedContent.replace(/href="([^"]*)"/gi, (match, url) => {
            if (url.startsWith('mailto:') || url.startsWith('#') || !url.startsWith('http')) return match;
            const trackerUrl = `${baseUrl}/api/public/track/click?c=${campaignRecord.id}&l=${lead.id}&u=${encodeURIComponent(url)}`;
            return `href="${trackerUrl}"`;
          });

          // 3. Open Tracking (Inject Pixel)
          const pixelUrl = `${baseUrl}/api/public/track/open?c=${campaignRecord.id}&l=${lead.id}`;
          const pixelTag = `<img src="${pixelUrl}" width="1" height="1" border="0" alt="" style="height:1px !important;width:1px !important;border-width:0 !important;margin:0 !important;padding:0 !important;" />`;

          if (customizedContent.toLowerCase().includes('</body>')) {
            customizedContent = customizedContent.replace(/<\/body>/i, `${pixelTag}</body>`);
          } else {
            customizedContent += pixelTag;
          }

          const success = await sendTemplateEmail(lead.email, subject, customizedContent);
          if (success) {
            deliveredCount++;
            console.log(`[Campaign Launch] Successfully sent to ${lead.email}`);
          } else {
            console.error(`[Campaign Launch] FAILED to send to ${lead.email}`);
          }
        } else {
          console.warn(`[Campaign Launch] Lead ${lead.id} has no email address. Skipping.`);
        }
      }
    }

    await prisma.campaign.update({
      where: { id },
      data: {
        status: 4, // Sent
        sentAt: new Date(),
        deliveredCount: deliveredCount,
        totalRecipients: campaignRecord.group?.leads?.length || 0,
        updatedAt: new Date()
      }
    });

    res.status(200).json({
      success: true,
      message: `Campaign launched successfully. Sent to ${deliveredCount} of ${campaignRecord.group?.leads?.length || 0} leads.`,
      data: { sentCount: deliveredCount }
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

    const campaigns = await prisma.campaign.findMany({
      where: { tenantId, status: 4 }
    });

    const totalDelivered = campaigns.reduce((acc, c) => acc + (c.deliveredCount || 0), 0);
    const totalOpened = campaigns.reduce((acc, c) => acc + (c.openedCount || 0), 0);
    const totalClicked = campaigns.reduce((acc, c) => acc + (c.clickedCount || 0), 0);

    // Count form submissions from interactions
    const totalSubmissions = await prisma.leadInteraction.count({
      where: {
        type: 'FORM_SUBMIT',
        lead: { tenantId }
      }
    });

    res.status(200).json({
      success: true,
      data: {
        sentCampaigns: campaigns.length,
        totalDelivered,
        totalOpened,
        totalClicked,
        totalSubmissions,
        // Keep old fields for compatibility if needed, but primary are above
        totalSent: totalDelivered
      }
    });
  } catch (error) {
    console.error('Get campaign stats error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching stats' });
  }
};

module.exports = {
  getAllCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  launchCampaign,
  getCampaignStats
};
