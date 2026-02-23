const axios = require('axios');
const crypto = require('crypto');
const { prisma } = require('../../config/database');
const aiService = require('./aiService');
const propertyService = require('./propertyService');

const WHATSAPP_API_URL = 'https://graph.facebook.com/v22.0';

/**
 * Enhanced WhatsApp Service with Chatbot logic
 */
class WhatsAppService {
    /**
     * Clean token of common copy-paste artifacts
     */
    cleanToken(token) {
        if (!token) return null;
        // Remove 'WHATSAPP_ACCESS_TOKEN=' prefix if it exists
        let clean = token.replace(/^WHATSAPP_ACCESS_TOKEN=/, '');
        // Remove quotes around the token
        clean = clean.replace(/^["']|["']$/g, '');
        return clean.trim();
    }

    /**
     * Generate appsecret_proof for Meta API calls
     * @see https://developers.facebook.com/docs/graph-api/security#appsecret_proof
     */
    generateAppSecretProof(accessToken) {
        // Temporarily disabled for debugging
        return null;

        const appSecret = process.env.META_APP_SECRET;
        const cleanedToken = this.cleanToken(accessToken);
        if (!appSecret || !cleanedToken) return null;

        return crypto
            .createHmac('sha256', appSecret)
            .update(cleanedToken)
            .digest('hex');
    }

    /**
     * Sync templates from Meta to local database
     */
    async syncTemplatesFromMeta({ tenantId, wabaId, accessToken }) {
        try {
            const rawToken = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
            const token = this.cleanToken(rawToken);

            if (!token) {
                return {
                    success: false,
                    message: 'WhatsApp access token not configured'
                };
            }

            const appsecretProof = this.generateAppSecretProof(token);
            const url = `${WHATSAPP_API_URL}/${wabaId}/message_templates`;
            const params = appsecretProof ? { appsecret_proof: appsecretProof } : {};

            console.log(`[WhatsAppService] Syncing templates for WABA: ${wabaId}`);

            const response = await axios.get(url, {
                params,
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

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
                            variables: []
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
    }

    /**
     * Send general text message
     */
    async sendTextMessage({ phoneNumberId, to, text, accessToken }) {
        try {
            const rawToken = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
            const token = this.cleanToken(rawToken);
            const appsecretProof = this.generateAppSecretProof(token);

            const response = await axios.post(
                `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: to,
                    type: 'text',
                    text: { body: text },
                    ...(appsecretProof ? { appsecret_proof: appsecretProof } : {})
                },
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );
            return { success: true, messageId: response.data.messages[0].id };
        } catch (error) {
            console.error('Send text message error:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send Template message
     */
    async sendMessage({ phoneNumberId, to, templateName, components, languageCode = 'en', accessToken }) {
        try {
            const rawToken = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
            const token = this.cleanToken(rawToken);
            const appsecretProof = this.generateAppSecretProof(token);

            const messageData = {
                messaging_product: 'whatsapp',
                to,
                type: 'template',
                template: {
                    name: templateName,
                    language: {
                        code: languageCode
                    }
                },
                ...(appsecretProof ? { appsecret_proof: appsecretProof } : {})
            };

            console.log(`[WhatsAppService] Sending template message: ${templateName} to ${to} (Language: ${languageCode})`);

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
    }

    /**
     * Send Buttons message
     */
    async sendButtonsMessage({ phoneNumberId, to, text, buttons, accessToken }) {
        try {
            const rawToken = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
            const token = this.cleanToken(rawToken);
            const appsecretProof = this.generateAppSecretProof(token);

            const response = await axios.post(
                `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: to,
                    type: 'interactive',
                    interactive: {
                        type: 'button',
                        body: { text: text },
                        action: {
                            buttons: buttons.map((b, i) => ({
                                type: 'reply',
                                reply: { id: b.id || `btn_${i}`, title: b.title }
                            }))
                        }
                    },
                    ...(appsecretProof ? { appsecret_proof: appsecretProof } : {})
                },
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );
            return { success: true, messageId: response.data.messages[0].id };
        } catch (error) {
            console.error('Send buttons error:', error.response?.data || error.message);
            return { success: false };
        }
    }

    /**
     * Handle incoming message from webhook (Chatbot Logic)
     */
    async handleIncomingMessage(message, metadata) {
        try {
            const { from, id: messageId, text, type, interactive } = message;
            const phoneNumberId = metadata.phone_number_id;
            const displayPhoneNumber = metadata.display_phone_number;

            // Find connected account by phoneNumberId in metadata
            const account = await prisma.connectedAccount.findFirst({
                where: {
                    platform: 'WHATSAPP',
                    metadata: {
                        path: ['phoneNumberId'],
                        equals: phoneNumberId
                    }
                },
                include: { tenant: true }
            });

            if (!account) {
                console.warn(`No connected account found for phoneNumberId: ${phoneNumberId}`);
                return { success: false };
            }

            const tenantId = account.tenantId;
            const accessToken = account.accessToken;
            const businessName = account.tenant.name;

            // Save incoming message
            const savedMessage = await prisma.whatsAppMessage.create({
                data: {
                    tenantId,
                    senderNumber: from,
                    messageText: text?.body || (interactive?.button_reply?.title) || `[${type}]`,
                    direction: 'INBOUND',
                    metaMessageId: messageId,
                    status: 'received'
                }
            });

            // Process message (Chatbot logic)
            let userText = text?.body || '';
            if (interactive?.button_reply) {
                userText = interactive.button_reply.title;
            }

            if (!userText) return { success: true };

            // 1. Manage Lead
            let lead = await prisma.lead.findFirst({
                where: {
                    tenantId,
                    phone: from
                }
            });

            if (!lead) {
                // Create new lead
                lead = await prisma.lead.create({
                    data: {
                        tenantId,
                        name: `WhatsApp User (${from})`,
                        phone: from,
                        source: 7, // Chatbot
                        status: 1, // New
                        priority: 2, // Medium
                        notes: `Original sender: ${from}`
                    }
                });

                // Trigger LEAD_CREATED workflow
                try {
                    const WorkflowService = require('../marketing/WorkflowService');
                    await WorkflowService.triggerWorkflows(tenantId, lead.id, 'LEAD_CREATED');
                } catch (wfError) {
                    console.error('Error triggering WhatsApp lead workflow:', wfError);
                }
            }

            // Enrich lead preferences using Unified Automation Hub logic
            const leadNurtureService = require('./leadNurtureService');
            // skipNotification: true because whatsappService handles its own interactive reply below
            await leadNurtureService.enrichLeadPreferences(lead.id, userText, {}, { skipNotification: true });

            // Re-fetch lead to get updated preferences for interaction logging
            const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
            const filters = updatedLead.preferences || {};

            // Log interaction
            await prisma.leadInteraction.create({
                data: {
                    tenantId,
                    leadId: lead.id,
                    type: 'CHAT_INIT',
                    metadata: {
                        platform: 'WHATSAPP',
                        message: userText,
                        filters
                    }
                }
            });

            // 2. Search properties if keywords detected or filters extracted
            const propertyKeywords = ['property', 'properties', 'house', 'home', 'apartment', 'villa', 'flat', 'show', 'looking', 'need', 'want', 'search'];
            const isPropertySearch = propertyKeywords.some(k => userText.toLowerCase().includes(k)) || Object.keys(filters).length > 0;

            if (isPropertySearch) {
                const properties = await propertyService.searchProperties(filters, tenantId);

                if (properties.length > 0) {
                    await this.sendTextMessage({
                        phoneNumberId,
                        to: from,
                        text: `I found ${properties.length} properties matching your needs! 🏠✨`,
                        accessToken
                    });

                    for (const prop of properties) {
                        const formattedMsg = propertyService.formatPropertyMessage(prop);
                        await this.sendTextMessage({
                            phoneNumberId,
                            to: from,
                            text: formattedMsg,
                            accessToken
                        });
                    }

                    // Send call to action buttons
                    await this.sendButtonsMessage({
                        phoneNumberId,
                        to: from,
                        text: "Would you like to speak with an agent or see more options?",
                        buttons: [
                            { id: 'talk_agent', title: "Talk to Agent" },
                            { id: 'more_props', title: "Show More" }
                        ],
                        accessToken
                    });
                } else {
                    const noResMsg = aiService.getNoResultsMessage(filters, { businessName });
                    await this.sendTextMessage({
                        phoneNumberId,
                        to: from,
                        text: noResMsg,
                        accessToken
                    });
                }
            } else {
                // 3. Simple AI Response for other queries
                const aiResponse = await aiService.processMessage(userText, [], { businessName });
                await this.sendTextMessage({
                    phoneNumberId,
                    to: from,
                    text: aiResponse,
                    accessToken
                });
            }

            return { success: true };
        } catch (error) {
            console.error('Handle incoming message error:', error);
            return { success: false };
        }
    }

    /**
     * Handle message status update from webhook
     */
    async handleMessageStatus(status) {
        try {
            const { id: messageId, status: messageStatus } = status;

            const message = await prisma.whatsAppMessage.findFirst({
                where: { metaMessageId: messageId }
            });

            if (message) {
                await prisma.whatsAppMessage.update({
                    where: { id: message.id },
                    data: { status: messageStatus }
                });

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
    }

    /**
     * Send bulk messages for campaign
     */
    async sendBulkMessages({ tenantId, campaignId, phoneNumberId, templateName, recipients, accessToken }) {
        try {
            let sentCount = 0;
            let failedCount = 0;

            // Fetch template to get the correct language code
            const template = await prisma.whatsAppTemplate.findFirst({
                where: { tenantId, name: templateName }
            });

            const languageCode = template?.language || 'en_US';

            for (const recipient of recipients) {
                const result = await this.sendMessage({
                    phoneNumberId,
                    to: recipient.phone,
                    templateName,
                    components: recipient.components,
                    languageCode,
                    accessToken
                });

                if (result.success) {
                    sentCount++;
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

                await new Promise(resolve => setTimeout(resolve, 100));
            }

            await prisma.whatsAppCampaign.update({
                where: { id: campaignId },
                data: {
                    sentCount: { increment: sentCount },
                    failedCount: { increment: failedCount },
                    status: 'SENT'
                }
            });

            return { success: true, sentCount, failedCount };
        } catch (error) {
            console.error('Send bulk messages error:', error);
            return { success: false, message: 'Failed to send bulk messages' };
        }
    }

    /**
     * Basic Metadata helper
     */
    async getBusinessAccountInfo(wabaId, accessToken) {
        try {
            const rawToken = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
            const token = this.cleanToken(rawToken);
            const appsecretProof = this.generateAppSecretProof(token);

            const response = await axios.get(`${WHATSAPP_API_URL}/${wabaId}`, {
                params: {
                    fields: 'id,name,timezone_id,message_template_namespace',
                    ...(appsecretProof ? { appsecret_proof: appsecretProof } : {})
                },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Get business info error:', error.response?.data || error.message);
            return {
                success: false,
                message: error.response?.data?.error?.message || 'Failed to fetch business info'
            };
        }
    }

    async getPhoneNumberInfo(phoneNumberId, accessToken) {
        try {
            const rawToken = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
            const token = this.cleanToken(rawToken);
            const appsecretProof = this.generateAppSecretProof(token);

            const response = await axios.get(`${WHATSAPP_API_URL}/${phoneNumberId}`, {
                params: {
                    fields: 'id,display_phone_number,verified_name,quality_rating',
                    ...(appsecretProof ? { appsecret_proof: appsecretProof } : {})
                },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Get phone info error:', error.response?.data || error.message);
            return {
                success: false,
                message: error.response?.data?.error?.message || 'Failed to fetch phone info'
            };
        }
    }

    /**
     * Create WhatsApp message template in Meta
     */
    async createTemplate({ wabaId, name, category, language, components, accessToken }) {
        try {
            const rawToken = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
            const token = this.cleanToken(rawToken);
            const appsecretProof = this.generateAppSecretProof(token);

            const response = await axios.post(
                `${WHATSAPP_API_URL}/${wabaId}/message_templates`,
                {
                    name,
                    category,
                    language,
                    components,
                    ...(appsecretProof ? { appsecret_proof: appsecretProof } : {})
                },
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Create template error:', error.response?.data || error.message);
            let message = error.response?.data?.error?.message || 'Failed to create template';

            // Helpful hint for common ID confusion
            if (message.includes('Object with ID') && message.includes('does not exist')) {
                message += " (Tip: Check if you provided a WABA ID instead of a Phone ID, or vice versa)";
            }

            return {
                success: false,
                message
            };
        }
    }

    /**
     * Delete WhatsApp message template in Meta
     */
    async deleteTemplate(wabaId, templateName, accessToken) {
        try {
            const rawToken = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
            const token = this.cleanToken(rawToken);
            const appsecretProof = this.generateAppSecretProof(token);

            await axios.delete(
                `${WHATSAPP_API_URL}/${wabaId}/message_templates`,
                {
                    params: {
                        name: templateName,
                        ...(appsecretProof ? { appsecret_proof: appsecretProof } : {})
                    },
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );

            return { success: true };
        } catch (error) {
            console.error('Delete template error:', error.response?.data || error.message);
            return {
                success: false,
                message: error.response?.data?.error?.message || 'Failed to delete template'
            };
        }
    }
}

module.exports = new WhatsAppService();
