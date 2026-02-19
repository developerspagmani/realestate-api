const axios = require('axios');
const { prisma } = require('../../config/database');

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

/**
 * Sync templates from Meta to local database
 */
const syncTemplatesFromMeta = async ({ tenantId, wabaId, accessToken }) => {
    try {
        const token = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

        if (!token) {
            return {
                success: false,
                message: 'WhatsApp access token not configured'
            };
        }

        const response = await axios.get(
            `${WHATSAPP_API_URL}/${wabaId}/message_templates`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        const metaTemplates = response.data.data;
        const results = {
            synced: 0,
            skipped: 0,
            errors: 0
        };

        for (const template of metaTemplates) {
            try {
                await prisma.whatsAppTemplate.upsert({
                    where: {
                        tenantId_wabaId_name_language: {
                            tenantId,
                            wabaId,
                            name: template.name,
                            language: template.language
                        }
                    },
                    update: {
                        status: template.status,
                        category: template.category,
                        components: template.components,
                        updatedAt: new Date()
                    },
                    create: {
                        tenantId,
                        wabaId,
                        name: template.name,
                        status: template.status,
                        category: template.category,
                        language: template.language,
                        components: template.components,
                        variables: [] // Variables need to be parsed from components if needed
                    }
                });
                results.synced++;
            } catch (err) {
                console.error(`Error upserting template ${template.name}:`, err.message);
                results.errors++;
            }
        }

        return {
            success: true,
            data: results
        };
    } catch (error) {
        console.error('Sync templates error:', error.response?.data || error.message);
        return {
            success: false,
            message: error.response?.data?.error?.message || 'Failed to sync templates'
        };
    }
};

/**
 * Create WhatsApp template
 */
const createTemplate = async ({ wabaId, name, category, language, components, accessToken }) => {
    try {
        const token = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

        if (!token) {
            return {
                success: false,
                message: 'WhatsApp access token not configured'
            };
        }

        const response = await axios.post(
            `${WHATSAPP_API_URL}/${wabaId}/message_templates`,
            {
                name,
                category,
                language,
                components
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        console.error('Create template error:', error.response?.data || error.message);
        return {
            success: false,
            message: error.response?.data?.error?.message || 'Failed to create template'
        };
    }
};

/**
 * Send WhatsApp message
 */
const sendMessage = async ({ phoneNumberId, to, templateName, components, languageCode = 'en', accessToken }) => {
    try {
        const token = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

        if (!token) {
            return {
                success: false,
                message: 'WhatsApp access token not configured'
            };
        }

        const messageData = {
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: {
                name: templateName,
                language: {
                    code: languageCode
                }
            }
        };

        if (components && components.length > 0) {
            messageData.template.components = components;
        }

        const response = await axios.post(
            `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
            messageData,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return {
            success: true,
            messageId: response.data.messages[0].id
        };
    } catch (error) {
        console.error('Send message error:', error.response?.data || error.message);
        return {
            success: false,
            message: error.response?.data?.error?.message || 'Failed to send message'
        };
    }
};

/**
 * Send bulk messages for campaign
 */
const sendBulkMessages = async ({ tenantId, campaignId, phoneNumberId, templateName, recipients, accessToken }) => {
    try {
        let sentCount = 0;
        let failedCount = 0;

        for (const recipient of recipients) {
            const result = await sendMessage({
                phoneNumberId,
                to: recipient.phone,
                templateName,
                components: recipient.components,
                accessToken
            });

            if (result.success) {
                sentCount++;
                // Log outbound message linked to campaign
                await prisma.whatsAppMessage.create({
                    data: {
                        tenantId,
                        campaignId,
                        senderNumber: recipient.phone,
                        messageText: `Template: ${templateName}`,
                        direction: 'OUTBOUND',
                        metaMessageId: result.messageId,
                        status: 'sent'
                    }
                });
            } else {
                failedCount++;
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Update campaign stats
        await prisma.whatsAppCampaign.update({
            where: { id: campaignId },
            data: {
                sentCount: { increment: sentCount },
                failedCount: { increment: failedCount },
                status: 'SENT'
            }
        });

        return {
            success: true,
            sentCount,
            failedCount
        };
    } catch (error) {
        console.error('Send bulk messages error:', error);
        return {
            success: false,
            message: 'Failed to send bulk messages'
        };
    }
};

/**
 * Handle message status update from webhook
 */
const handleMessageStatus = async (status) => {
    try {
        const { id: messageId, status: messageStatus } = status;

        // Update message in database
        const message = await prisma.whatsAppMessage.findFirst({
            where: { metaMessageId: messageId }
        });

        if (message) {
            await prisma.whatsAppMessage.update({
                where: { id: message.id },
                data: { status: messageStatus }
            });

            // Update campaign stats if message belongs to a campaign
            if (message.campaignId) {
                const updateData = {};
                if (messageStatus === 'delivered') updateData.deliveredCount = { increment: 1 };
                else if (messageStatus === 'read') updateData.readCount = { increment: 1 };
                else if (messageStatus === 'failed') updateData.failedCount = { increment: 1 };

                if (Object.keys(updateData).length > 0) {
                    await prisma.whatsAppCampaign.update({
                        where: { id: message.campaignId },
                        data: updateData
                    });
                }
            }
        }

        return { success: true };
    } catch (error) {
        console.error('Handle message status error:', error);
        return { success: false };
    }
};

/**
 * Handle incoming message from webhook
 */
const handleIncomingMessage = async (message) => {
    try {
        const { from, id: messageId, text, type } = message;

        // Save incoming message
        await prisma.whatsAppMessage.create({
            data: {
                senderNumber: from,
                messageText: text?.body || `[${type}]`,
                direction: 'INBOUND',
                metaMessageId: messageId,
                status: 'received'
            }
        });

        return { success: true };
    } catch (error) {
        console.error('Handle incoming message error:', error);
        return { success: false };
    }
};

/**
 * Get template status from Meta
 */
const getTemplateStatus = async (wabaId, templateName, accessToken) => {
    try {
        const token = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

        const response = await axios.get(
            `${WHATSAPP_API_URL}/${wabaId}/message_templates`,
            {
                params: { name: templateName },
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (response.data.data && response.data.data.length > 0) {
            return {
                success: true,
                status: response.data.data[0].status
            };
        }

        return {
            success: false,
            message: 'Template not found'
        };
    } catch (error) {
        console.error('Get template status error:', error);
        return {
            success: false,
            message: 'Failed to get template status'
        };
    }
};

/**
 * Delete template from Meta
 */
const deleteTemplate = async (wabaId, templateName, accessToken) => {
    try {
        const token = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

        await axios.delete(
            `${WHATSAPP_API_URL}/${wabaId}/message_templates`,
            {
                params: { name: templateName },
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        return { success: true };
    } catch (error) {
        console.error('Delete template error:', error);
        return {
            success: false,
            message: 'Failed to delete template'
        };
    }
};

/**
 * Get WhatsApp Business Account info
 */
const getBusinessAccountInfo = async (wabaId, accessToken) => {
    try {
        const token = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

        const response = await axios.get(
            `${WHATSAPP_API_URL}/${wabaId}`,
            {
                params: {
                    fields: 'id,name,timezone_id,message_template_namespace'
                },
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        console.error('Get business account info error:', error);
        return {
            success: false,
            message: 'Failed to get business account info'
        };
    }
};

/**
 * Get phone number info
 */
const getPhoneNumberInfo = async (phoneNumberId, accessToken) => {
    try {
        const token = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;

        const response = await axios.get(
            `${WHATSAPP_API_URL}/${phoneNumberId}`,
            {
                params: {
                    fields: 'id,display_phone_number,verified_name,quality_rating'
                },
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        return {
            success: true,
            data: response.data
        };
    } catch (error) {
        console.error('Get phone number info error:', error);
        return {
            success: false,
            message: 'Failed to get phone number info'
        };
    }
};

module.exports = {
    syncTemplatesFromMeta,
    createTemplate,
    sendMessage,
    sendBulkMessages,
    handleMessageStatus,
    handleIncomingMessage,
    getTemplateStatus,
    deleteTemplate,
    getBusinessAccountInfo,
    getPhoneNumberInfo
};
