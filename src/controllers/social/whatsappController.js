const { prisma } = require('../../config/database');
const whatsappService = require('../../services/social/whatsappService');

/**
 * Get the WhatsApp account for a tenant
 */
const getWhatsAppAccount = async (tenantId) => {
    return await prisma.connectedAccount.findFirst({
        where: { tenantId, platform: 'WHATSAPP', isActive: true }
    });
};

/**
 * Sync templates from Meta
 * @route POST /api/social/whatsapp/templates/sync
 */
const syncTemplates = async (req, res) => {
    try {
        const tenantId = req.tenant?.id || req.user?.tenantId;
        const account = await getWhatsAppAccount(tenantId);

        if (!account || !account.accessToken || !account.accountId) {
            return res.status(400).json({
                success: false,
                message: 'WhatsApp account not connected or mission WABA ID/Token'
            });
        }

        const result = await whatsappService.syncTemplatesFromMeta({
            tenantId,
            wabaId: account.accountId,
            accessToken: account.accessToken
        });

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }

        res.status(200).json({
            success: true,
            message: 'Templates synced successfully',
            data: result.data
        });
    } catch (error) {
        console.error('Sync templates error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error syncing templates'
        });
    }
};

/**
 * Get all WhatsApp templates
 * @route GET /api/social/whatsapp/templates
 */
const getTemplates = async (req, res) => {
    try {
        const tenantId = req.tenant?.id || req.user?.tenantId;

        const templates = await prisma.whatsAppTemplate.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({
            success: true,
            data: { templates }
        });
    } catch (error) {
        console.error('Get templates error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching templates'
        });
    }
};

/**
 * Create WhatsApp template
 * @route POST /api/social/whatsapp/templates
 */
const createTemplate = async (req, res) => {
    try {
        const tenantId = req.tenant?.id || req.user?.tenantId;
        const { wabaId, name, category, language, components, variables } = req.body;

        const account = await getWhatsAppAccount(tenantId);
        const accessToken = account?.accessToken;

        // Validate required fields
        if (!wabaId || !name || !category || !language || !components) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Create template in Meta API
        const metaResponse = await whatsappService.createTemplate({
            wabaId,
            name,
            category,
            language,
            components,
            accessToken
        });

        if (!metaResponse.success) {
            return res.status(400).json({
                success: false,
                message: metaResponse.message || 'Failed to create template in WhatsApp'
            });
        }

        // Save template to database
        const template = await prisma.whatsAppTemplate.create({
            data: {
                tenantId,
                wabaId,
                name,
                category,
                language,
                status: 'PENDING',
                components,
                variables: variables || []
            }
        });

        res.status(201).json({
            success: true,
            data: { template }
        });
    } catch (error) {
        console.error('Create template error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating template'
        });
    }
};

/**
 * Get template by ID
 * @route GET /api/social/whatsapp/templates/:id
 */
const getTemplateById = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        const template = await prisma.whatsAppTemplate.findFirst({
            where: { id, tenantId }
        });

        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'Template not found'
            });
        }

        res.status(200).json({
            success: true,
            data: { template }
        });
    } catch (error) {
        console.error('Get template error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching template'
        });
    }
};

/**
 * Delete template
 * @route DELETE /api/social/whatsapp/templates/:id
 */
const deleteTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        const template = await prisma.whatsAppTemplate.findFirst({
            where: { id, tenantId }
        });

        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'Template not found'
            });
        }

        const account = await getWhatsAppAccount(tenantId);

        // Delete from Meta if we have the account info
        if (account && account.accountId && account.accessToken) {
            await whatsappService.deleteTemplate(account.accountId, template.name, account.accessToken);
        }

        await prisma.whatsAppTemplate.delete({
            where: { id }
        });

        res.status(200).json({
            success: true,
            message: 'Template deleted successfully'
        });
    } catch (error) {
        console.error('Delete template error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error deleting template'
        });
    }
};

/**
 * Get all WhatsApp campaigns
 * @route GET /api/social/whatsapp/campaigns
 */
const getCampaigns = async (req, res) => {
    try {
        const tenantId = req.tenant?.id || req.user?.tenantId;
        const userId = req.user.id;

        const campaigns = await prisma.whatsAppCampaign.findMany({
            where: { tenantId, userId },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({
            success: true,
            data: { campaigns }
        });
    } catch (error) {
        console.error('Get campaigns error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching campaigns'
        });
    }
};

/**
 * Create WhatsApp campaign
 * @route POST /api/social/whatsapp/campaigns
 */
const createCampaign = async (req, res) => {
    try {
        const tenantId = req.tenant?.id || req.user?.tenantId;
        const userId = req.user.id;
        const { wabaId, phoneNumberId, templateName, name, scheduledAt, recipients } = req.body;

        // Validate required fields
        if (!wabaId || !phoneNumberId || !templateName || !name) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        const account = await getWhatsAppAccount(tenantId);
        const accessToken = account?.accessToken;

        // Create campaign
        const campaign = await prisma.whatsAppCampaign.create({
            data: {
                tenantId,
                userId,
                wabaId,
                phoneNumberId,
                templateName,
                name,
                status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
                scheduledAt: scheduledAt ? new Date(scheduledAt) : null
            }
        });

        // If recipients provided, send messages immediately
        if (recipients && recipients.length > 0 && !scheduledAt) {
            await whatsappService.sendBulkMessages({
                tenantId,
                campaignId: campaign.id,
                phoneNumberId,
                templateName,
                recipients,
                accessToken
            });
        }

        res.status(201).json({
            success: true,
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

/**
 * Get campaign by ID
 * @route GET /api/social/whatsapp/campaigns/:id
 */
const getCampaignById = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenant?.id || req.user?.tenantId;
        const userId = req.user.id;

        const campaign = await prisma.whatsAppCampaign.findFirst({
            where: { id, tenantId, userId }
        });

        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
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

/**
 * Get campaign statistics
 * @route GET /api/social/whatsapp/campaigns/:id/stats
 */
const getCampaignStats = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenant?.id || req.user?.tenantId;
        const userId = req.user.id;

        const campaign = await prisma.whatsAppCampaign.findFirst({
            where: { id, tenantId, userId }
        });

        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        const stats = {
            sent: campaign.sentCount,
            delivered: campaign.deliveredCount,
            read: campaign.readCount,
            failed: campaign.failedCount,
            deliveryRate: campaign.sentCount > 0
                ? ((campaign.deliveredCount / campaign.sentCount) * 100).toFixed(2)
                : 0,
            readRate: campaign.deliveredCount > 0
                ? ((campaign.readCount / campaign.deliveredCount) * 100).toFixed(2)
                : 0
        };

        res.status(200).json({
            success: true,
            data: { stats }
        });
    } catch (error) {
        console.error('Get campaign stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching campaign stats'
        });
    }
};

/**
 * Get WhatsApp messages
 * @route GET /api/social/whatsapp/messages
 */
const getMessages = async (req, res) => {
    try {
        const tenantId = req.tenant?.id || req.user?.tenantId;
        const { page = 1, limit = 50, direction } = req.query;

        const where = { tenantId };
        if (direction) {
            where.direction = direction;
        }

        const messages = await prisma.whatsAppMessage.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: parseInt(limit)
        });

        const total = await prisma.whatsAppMessage.count({ where });

        res.status(200).json({
            success: true,
            data: {
                messages,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching messages'
        });
    }
};

/**
 * Send WhatsApp message
 * @route POST /api/social/whatsapp/messages
 */
const sendMessage = async (req, res) => {
    try {
        const tenantId = req.tenant?.id || req.user?.tenantId;
        const { phoneNumberId, to, templateName, components, text } = req.body;

        if (!phoneNumberId || !to || (!templateName && !text)) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: to, phoneNumberId and (templateName or text)'
            });
        }

        const account = await getWhatsAppAccount(tenantId);
        const accessToken = account?.accessToken;

        let result;
        if (templateName) {
            result = await whatsappService.sendMessage({
                phoneNumberId,
                to,
                templateName,
                components,
                accessToken
            });
        } else {
            result = await whatsappService.sendTextMessage({
                phoneNumberId,
                to,
                text,
                accessToken
            });
        }

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message || 'Failed to send message'
            });
        }

        // Log message
        await prisma.whatsAppMessage.create({
            data: {
                tenantId,
                senderNumber: to,
                messageText: templateName || text,
                direction: 'OUTBOUND',
                metaMessageId: result.messageId,
                status: 'sent'
            }
        });

        res.status(200).json({
            success: true,
            data: { messageId: result.messageId }
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error sending message'
        });
    }
};

/**
 * Handle WhatsApp webhook
 * @route POST /api/social/whatsapp/webhook
 */
const handleWebhook = async (req, res) => {
    try {
        const { entry } = req.body;

        if (!entry || !entry[0]) {
            return res.status(200).send('OK');
        }

        const changes = entry[0].changes;
        if (!changes || !changes[0]) {
            return res.status(200).send('OK');
        }

        const value = changes[0].value;
        const metadata = value.metadata;

        // Handle message status updates
        if (value.statuses) {
            for (const status of value.statuses) {
                await whatsappService.handleMessageStatus(status).catch(err => console.error('Status error:', err));
            }
        }

        // Handle incoming messages
        if (value.messages) {
            for (const message of value.messages) {
                await whatsappService.handleIncomingMessage(message, metadata).catch(err => console.error('Message error:', err));
            }
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(200).send('OK'); // Always return 200 to Meta
    }
};

/**
 * Verify WhatsApp webhook
 * @route GET /api/social/whatsapp/webhook
 */
const verifyWebhook = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'your_verify_token';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('Webhook verified');
        res.status(200).send(challenge);
    } else {
        res.status(403).send('Forbidden');
    }
};

/**
 * Get WhatsApp Business Account Info from Meta
 */
const getBusinessInfo = async (req, res) => {
    try {
        const { wabaId } = req.params;
        const tenantId = req.tenant?.id || req.user?.tenantId;
        const account = await getWhatsAppAccount(tenantId);
        const accessToken = account?.accessToken;

        const result = await whatsappService.getBusinessAccountInfo(wabaId, accessToken);
        if (!result.success) {
            return res.status(400).json(result);
        }

        res.status(200).json(result);
    } catch (error) {
        console.error('Get business info error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching business info' });
    }
};

/**
 * Get Phone Number Info from Meta
 */
const getPhoneInfo = async (req, res) => {
    try {
        const { phoneId } = req.params;
        const tenantId = req.tenant?.id || req.user?.tenantId;
        const account = await getWhatsAppAccount(tenantId);
        const accessToken = account?.accessToken;

        const result = await whatsappService.getPhoneNumberInfo(phoneId, accessToken);
        if (!result.success) {
            return res.status(400).json(result);
        }

        res.status(200).json(result);
    } catch (error) {
        console.error('Get phone info error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching phone info' });
    }
};

module.exports = {
    syncTemplates,
    getTemplates,
    createTemplate,
    getTemplateById,
    deleteTemplate,
    getCampaigns,
    createCampaign,
    getCampaignById,
    getCampaignStats,
    getMessages,
    sendMessage,
    handleWebhook,
    verifyWebhook,
    getBusinessInfo,
    getPhoneInfo
};
