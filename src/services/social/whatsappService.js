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

            // Find connected account
            const account = await prisma.connectedAccount.findFirst({
                where: {
                    platform: 'WHATSAPP',
                    metadata: { path: ['phoneNumberId'], equals: phoneNumberId }
                },
                include: { tenant: { include: { whatsappChatbot: true } } }
            });

            if (!account) return { success: false };

            const tenantId = account.tenantId;
            const accessToken = account.accessToken;
            const businessName = account.tenant.name;
            const chatbotConfig = account.tenant.whatsappChatbot;

            // Save incoming message
            let userText = text?.body || (interactive?.button_reply?.title) || `[${type}]`;
            await prisma.whatsAppMessage.create({
                data: {
                    tenantId,
                    senderNumber: from,
                    messageText: userText,
                    direction: 'INBOUND',
                    metaMessageId: messageId,
                    status: 'received'
                }
            });

            if (!userText && !interactive) return { success: true };

            // Manage Lead
            let lead = await prisma.lead.findFirst({ where: { tenantId, phone: from } });
            if (!lead) {
                lead = await prisma.lead.create({
                    data: {
                        tenantId,
                        name: `WhatsApp User (${from})`,
                        phone: from,
                        source: 7,
                        status: 1
                    }
                });
                try {
                    const WorkflowService = require('../marketing/WorkflowService');
                    await WorkflowService.triggerWorkflows(tenantId, lead.id, 'LEAD_CREATED');
                } catch (e) { }
            }

            // 🤖 CONFIGURABLE FUNNEL LOGIC
            if (chatbotConfig && chatbotConfig.isActive) {
                const steps = chatbotConfig.steps || [];
                let currentStepId = lead.preferences?.chatbotStepId;
                let nextStepId = null;

                // 1. Handle Response to previous step
                if (interactive?.button_reply) {
                    const buttonId = interactive.button_reply.id;

                    // 📅 Global Booking Button Handler
                    if (buttonId.startsWith('btn_book_')) {
                        nextStepId = 'ask_booking_date';
                    }
                    else if (buttonId === 'btn_confirm_yes') {
                        nextStepId = 'confirm_booking';
                    }
                    else if (buttonId === 'btn_confirm_no') {
                        nextStepId = 'ask_booking_date';
                    }
                    else if (buttonId.startsWith('btn_date_')) {
                        nextStepId = 'check_availability';
                        const dateValue = buttonId.replace('btn_date_', '').toUpperCase();
                        const leadNurtureService = require('./leadNurtureService');
                        await leadNurtureService.enrichLeadPreferences(lead.id, null, { lastBookingDate: dateValue }, { skipNotification: true });
                    }
                    else {
                        // Regular funnel button handler
                        const steps = chatbotConfig.steps || [];
                        const currentStep = steps.find(s => s.id === currentStepId);
                        const button = currentStep?.buttons?.find(b => b.id === buttonId || b.label === interactive.button_reply.title);

                        if (button) {
                            nextStepId = button.nextStepId;
                            // Save choice if configured
                            if (button.fieldToSave && button.valueToSave !== undefined) {
                                const leadNurtureService = require('./leadNurtureService');
                                await leadNurtureService.enrichLeadPreferences(lead.id, null, { [button.fieldToSave]: button.valueToSave }, { skipNotification: true });
                            }
                        }
                    }
                }

                // Keyword handlers
                if (!nextStepId) {
                    const lowerText = userText.toLowerCase();
                    const resetKeywords = ['hi', 'hello', 'start', 'menu', 'hey', 'help'];

                    if (lowerText.includes('book')) {
                        nextStepId = 'ask_booking_date';
                    } else if (!currentStepId || resetKeywords.includes(lowerText)) {
                        nextStepId = chatbotConfig.startStepId || steps[0]?.id;
                    } else {
                        nextStepId = currentStepId;
                    }
                }

                if (nextStepId) {
                    const nextStep = steps.find(s => s.id === nextStepId);

                    if (nextStep) {
                        await prisma.lead.update({
                            where: { id: lead.id },
                            data: { preferences: { ...(lead.preferences || {}), chatbotStepId: nextStepId } }
                        });
                        return await this.executeBotStep(nextStep, { lead, phoneNumberId, from, accessToken, businessName });
                    } else {
                        // 🛠️ VIRTUAL STEPS: Support booking even if steps are missing from JSON
                        const virtualSteps = {
                            'ask_booking_date': {
                                id: 'ask_booking_date',
                                type: 'question',
                                content: 'When would you like to visit? Please choose a day:',
                                buttons: [
                                    { id: 'btn_date_today', label: 'Today' },
                                    { id: 'btn_date_tomorrow', label: 'Tomorrow' },
                                    { id: 'btn_date_weekend', label: 'This Weekend' }
                                ]
                            },
                            'check_availability': { id: 'check_availability', type: 'action', actionType: 'CHECK_AVAILABILITY' },
                            'confirm_booking': { id: 'confirm_booking', type: 'action', actionType: 'CREATE_BOOKING' }
                        };

                        if (virtualSteps[nextStepId]) {
                            await prisma.lead.update({
                                where: { id: lead.id },
                                data: { preferences: { ...(lead.preferences || {}), chatbotStepId: nextStepId } }
                            });
                            return await this.executeBotStep(virtualSteps[nextStepId], { lead, phoneNumberId, from, accessToken, businessName });
                        }

                        // Fallback: If step is missing and not virtual, reset to start
                        const startStepId = chatbotConfig.startStepId || steps[0]?.id;
                        const startStep = steps.find(s => s.id === startStepId);
                        if (startStep) {
                            await prisma.lead.update({
                                where: { id: lead.id },
                                data: { preferences: { ...(lead.preferences || {}), chatbotStepId: startStepId } }
                            });
                            return await this.executeBotStep(startStep, { lead, phoneNumberId, from, accessToken, businessName });
                        }
                    }
                }
            }

            // Fallback AI
            const leadNurtureService = require('./leadNurtureService');
            await leadNurtureService.enrichLeadPreferences(lead.id, userText, {}, { skipNotification: true });

            const updatedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
            const filters = updatedLead.preferences || {};

            const propertyKeywords = ['property', 'properties', 'house', 'home', 'apartment', 'villa', 'flat', 'search'];
            const isPropertySearch = propertyKeywords.some(k => userText.toLowerCase().includes(k)) || Object.keys(filters).length > 1;

            if (isPropertySearch) {
                const properties = await propertyService.searchProperties(filters, tenantId);
                if (properties.length > 0) {
                    await this.sendTextMessage({ phoneNumberId, to: from, text: `I found ${properties.length} matches! 🏠✨`, accessToken });
                    for (const prop of properties.slice(0, 3)) {
                        const propertyText = propertyService.formatPropertyMessage(prop);
                        await this.sendButtonsMessage({
                            phoneNumberId,
                            to: from,
                            text: propertyText,
                            buttons: [
                                { id: `btn_book_${prop.id.substring(0, 8)}`, title: "Book Visit" }
                            ],
                            accessToken
                        });
                    }
                    await this.sendButtonsMessage({
                        phoneNumberId, to: from, text: "Would you like more options?",
                        buttons: [{ id: 'talk_agent', title: "Talk to Agent" }, { id: 'more_props', title: "Show More" }],
                        accessToken
                    });
                } else {
                    await this.sendTextMessage({ phoneNumberId, to: from, text: aiService.getNoResultsMessage(filters, { businessName }), accessToken });
                }
            } else {
                const aiResponse = await aiService.processMessage(userText, [], { businessName });
                await this.sendTextMessage({ phoneNumberId, to: from, text: aiResponse, accessToken });
            }

            return { success: true };
        } catch (error) {
            console.error('Handle incoming message error:', error);
            return { success: false };
        }
    }

    /**
     * Helper to execute a single step of the funnel
     */
    async executeBotStep(step, context) {
        const { from, phoneNumberId, accessToken, businessName, lead } = context;

        if (step.type === 'question' && step.buttons?.length > 0) {
            return await this.sendButtonsMessage({
                phoneNumberId,
                to: from,
                text: step.content,
                buttons: step.buttons.map(b => ({ id: b.id, title: b.label })),
                accessToken
            });
        } else if (step.type === 'message') {
            await this.sendTextMessage({ phoneNumberId, to: from, text: step.content, accessToken });
            if (step.buttons?.length > 0) {
                return await this.sendButtonsMessage({
                    phoneNumberId, to: from, text: "Please choose an option:",
                    buttons: step.buttons.map(b => ({ id: b.id, title: b.label })),
                    accessToken
                });
            }
        } else if (step.type === 'action') {
            if (step.actionType === 'SEARCH_PROPERTIES') {
                const filters = lead.preferences || {};
                const properties = await propertyService.searchProperties(filters, lead.tenantId);
                if (properties.length > 0) {
                    await this.sendTextMessage({ phoneNumberId, to: from, text: `Matching properties for you:`, accessToken });
                    for (const prop of properties.slice(0, 3)) {
                        const propertyText = propertyService.formatPropertyMessage(prop);
                        await this.sendButtonsMessage({
                            phoneNumberId,
                            to: from,
                            text: propertyText,
                            buttons: [
                                { id: `btn_book_${prop.id.substring(0, 8)}`, title: "Book Visit" }
                            ],
                            accessToken
                        });
                    }
                    await this.sendButtonsMessage({
                        phoneNumberId, to: from, text: "Would you like more options?",
                        buttons: [{ id: 'talk_agent', title: "Talk to Agent" }, { id: 'more_props', title: "Show More" }],
                        accessToken
                    });
                } else {
                    await this.sendTextMessage({ phoneNumberId, to: from, text: aiService.getNoResultsMessage(filters, { businessName }), accessToken });
                }
            } else if (step.actionType === 'CHECK_AVAILABILITY') {
                await this.sendTextMessage({ phoneNumberId, to: from, text: `✅ That date is available!`, accessToken });
                await this.sendButtonsMessage({
                    phoneNumberId, to: from, text: "Would you like to confirm the booking?",
                    buttons: [
                        { id: 'btn_confirm_yes', title: "Yes, Confirm" },
                        { id: 'btn_confirm_no', title: "No, Change Date" }
                    ],
                    accessToken
                });
            } else if (step.actionType === 'CREATE_BOOKING') {
                try {
                    const booking = await prisma.booking.create({
                        data: {
                            tenantId: lead.tenantId,
                            leadId: lead.id,
                            status: 1,
                            bookingDate: new Date(),
                            notes: 'Booked via WhatsApp Chatbot'
                        }
                    });
                    await this.sendTextMessage({ phoneNumberId, to: from, text: `🎊 *Booking Confirmed!* Your visit has been scheduled.`, accessToken });
                    await this.sendTextMessage({ phoneNumberId, to: from, text: `Booking ID: #${booking.id.split('-')[0].toUpperCase()}`, accessToken });
                } catch (err) {
                    console.error('Booking error:', err);
                    await this.sendTextMessage({ phoneNumberId, to: from, text: `Error processing booking.`, accessToken });
                }
            }
        }
        return { success: true };
    }

    async handleMessageStatus(status) {
        try {
            const { id: messageId, status: messageStatus } = status;
            const message = await prisma.whatsAppMessage.findFirst({ where: { metaMessageId: messageId } });
            if (message) {
                await prisma.whatsAppMessage.update({ where: { id: message.id }, data: { status: messageStatus } });
                if (message.campaignId) {
                    const updateData = {};
                    if (messageStatus === 'delivered') updateData.deliveredCount = { increment: 1 };
                    else if (messageStatus === 'read') updateData.readCount = { increment: 1 };
                    else if (messageStatus === 'failed') updateData.failedCount = { increment: 1 };
                    if (Object.keys(updateData).length > 0) {
                        await prisma.whatsAppCampaign.update({ where: { id: message.campaignId }, data: updateData });
                    }
                }
            }
            return { success: true };
        } catch (error) {
            console.error('Status error:', error);
            return { success: false };
        }
    }

    async sendBulkMessages({ tenantId, campaignId, phoneNumberId, templateName, recipients, accessToken }) {
        try {
            let sentCount = 0;
            let failedCount = 0;
            const template = await prisma.whatsAppTemplate.findFirst({ where: { tenantId, name: templateName } });
            const languageCode = template?.language || 'en_US';

            for (const recipient of recipients) {
                const result = await this.sendMessage({ phoneNumberId, to: recipient.phone, templateName, components: recipient.components, languageCode, accessToken });
                if (result.success) {
                    sentCount++;
                    await prisma.whatsAppMessage.create({
                        data: { tenantId, campaignId, senderNumber: recipient.phone, messageText: `Template: ${templateName}`, direction: 'OUTBOUND', metaMessageId: result.messageId, status: 'sent' }
                    });
                } else {
                    failedCount++;
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            await prisma.whatsAppCampaign.update({ where: { id: campaignId }, data: { sentCount: { increment: sentCount }, failedCount: { increment: failedCount }, status: 'SENT' } });
            return { success: true, sentCount, failedCount };
        } catch (error) {
            console.error('Bulk send error:', error);
            return { success: false };
        }
    }

    async getBusinessAccountInfo(wabaId, accessToken) {
        try {
            const rawToken = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
            const token = this.cleanToken(rawToken);
            const appsecretProof = this.generateAppSecretProof(token);
            const response = await axios.get(`${WHATSAPP_API_URL}/${wabaId}`, {
                params: { fields: 'id,name,timezone_id,message_template_namespace', ...(appsecretProof ? { appsecret_proof: appsecretProof } : {}) },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async getPhoneNumberInfo(phoneNumberId, accessToken) {
        try {
            const rawToken = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
            const token = this.cleanToken(rawToken);
            const appsecretProof = this.generateAppSecretProof(token);
            const response = await axios.get(`${WHATSAPP_API_URL}/${phoneNumberId}`, {
                params: { fields: 'id,display_phone_number,verified_name,quality_rating', ...(appsecretProof ? { appsecret_proof: appsecretProof } : {}) },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async createTemplate({ wabaId, name, category, language, components, accessToken }) {
        try {
            const rawToken = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
            const token = this.cleanToken(rawToken);
            const appsecretProof = this.generateAppSecretProof(token);
            const response = await axios.post(`${WHATSAPP_API_URL}/${wabaId}/message_templates`, { name, category, language, components, ...(appsecretProof ? { appsecret_proof: appsecretProof } : {}) }, { headers: { 'Authorization': `Bearer ${token}` } });
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async deleteTemplate(wabaId, templateName, accessToken) {
        try {
            const rawToken = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
            const token = this.cleanToken(rawToken);
            const appsecretProof = this.generateAppSecretProof(token);
            await axios.delete(`${WHATSAPP_API_URL}/${wabaId}/message_templates`, { params: { name: templateName, ...(appsecretProof ? { appsecret_proof: appsecretProof } : {}) }, headers: { 'Authorization': `Bearer ${token}` } });
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
}

module.exports = new WhatsAppService();
