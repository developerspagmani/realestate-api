const { prisma } = require('../../config/database');
const aiService = require('./aiService');
const propertyService = require('./propertyService');
const whatsappService = require('./whatsappService');

/**
 * Unified Automation Hub Service
 * Handles Lead Matching, Nurturing, and Omni-channel notifications
 */
class LeadNurtureService {
    /**
     * Process a new lead or an updated lead message to extract preferences
     * (Called by Webhook handlers or Form submission controllers)
     */
    async enrichLeadPreferences(leadId, messageText) {
        try {
            const lead = await prisma.lead.findUnique({ where: { id: leadId } });
            if (!lead || !messageText) return;

            // Extract filters using AI Service
            const extractedFilters = await aiService.extractFilters(messageText);

            if (Object.keys(extractedFilters).length > 0) {
                const currentPrefs = lead.preferences || {};
                await prisma.lead.update({
                    where: { id: lead.id },
                    data: {
                        preferences: {
                            ...currentPrefs,
                            ...extractedFilters,
                            isWaitingForMatch: true, // Mark as waiting
                            lastInteractionAt: new Date()
                        },
                        budget: extractedFilters.maxPrice ? extractedFilters.maxPrice : lead.budget
                    }
                });

                console.log(`[LeadNurture] Enriched lead ${lead.id} with preferences:`, extractedFilters);

                // Immediately check if anything exists now
                await this.checkMatchesForLead(lead.id);
            }
        } catch (error) {
            console.error('[LeadNurture] Enrichment error:', error);
        }
    }

    /**
     * Scan for properties that match a specific lead's preferences
     */
    async checkMatchesForLead(leadId) {
        try {
            const lead = await prisma.lead.findUnique({
                where: { id: leadId },
                include: { tenant: true }
            });

            if (!lead || !lead.preferences || !lead.preferences.isWaitingForMatch) return;

            const filters = lead.preferences;
            const properties = await propertyService.searchProperties(filters, lead.tenantId);

            if (properties.length > 0) {
                console.log(`[LeadNurture] Found ${properties.length} matches for lead ${lead.id}`);
                await this.notifyLeadOfMatches(lead, properties);

                // Update lead to "Contacted"
                await prisma.lead.update({
                    where: { id: lead.id },
                    data: {
                        status: 2, // Contacted
                        preferences: {
                            ...lead.preferences,
                            isWaitingForMatch: false // Found a match, stop proactive waiting
                        }
                    }
                });
            }
        } catch (error) {
            console.error('[LeadNurture] Matching error:', error);
        }
    }

    /**
     * Hook to be called when a new property is created
     * Scans all waiting leads for a match
     */
    async findMatchesForNewProperty(propertyId) {
        try {
            const property = await prisma.property.findUnique({
                where: { id: propertyId },
                include: { units: { include: { unitPricing: true } } }
            });

            if (!property) return;

            // Find leads waiting for matches in this tenant
            const waitingLeads = await prisma.lead.findMany({
                where: {
                    tenantId: property.tenantId,
                    preferences: {
                        path: ['isWaitingForMatch'],
                        equals: true
                    }
                }
            });

            console.log(`[LeadNurture] Scanning ${waitingLeads.length} waiting leads for new property: ${property.title}`);

            for (const lead of waitingLeads) {
                const isMatch = this.checkIfPropertyMatchesLead(property, lead.preferences);
                if (isMatch) {
                    await this.notifyLeadOfMatches(lead, [property]);

                    // Update lead status
                    await prisma.lead.update({
                        where: { id: lead.id },
                        data: {
                            status: 2,
                            preferences: {
                                ...lead.preferences,
                                isWaitingForMatch: false
                            }
                        }
                    });
                }
            }
        } catch (error) {
            console.error('[LeadNurture] New property matching error:', error);
        }
    }

    /**
     * Logic for similarity-based matching (Fuzzy Logic)
     */
    checkIfPropertyMatchesLead(property, filters) {
        // 1. Location Match
        if (filters.location) {
            const locationStr = `${property.city} ${property.neighborhood} ${property.state}`.toLowerCase();
            if (!locationStr.includes(filters.location.toLowerCase())) return false;
        }

        // 2. Budget Match (Within 15% range)
        if (filters.maxPrice) {
            let minPropPrice = Infinity;
            property.units?.forEach(u => {
                u.unitPricing?.forEach(p => {
                    if (Number(p.price) < minPropPrice) minPropPrice = Number(p.price);
                });
            });

            if (minPropPrice === Infinity) return false;

            // Fuzzy: Allow if property price is up to 15% higher than their "max"
            const maxAllowed = filters.maxPrice * 1.15;
            if (minPropPrice > maxAllowed) return false;
        }

        // 3. BHK Match
        if (filters.bedrooms && property.bedrooms) {
            if (property.bedrooms < filters.bedrooms) return false;
        }

        return true;
    }

    /**
     * Send Multi-Channel Notifications
     */
    async notifyLeadOfMatches(lead, properties) {
        try {
            const hasWhatsApp = !!lead.phone;
            const hasEmail = !!lead.email;

            let messageBody = `🏠 *New Property Match Found!*\n\nHi ${lead.name}, we found properties matching your preferences:\n`;

            properties.forEach(p => {
                messageBody += `\n✨ *${p.title}*\n📍 ${p.city}\n🔗 View: ${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/p/${p.slug}\n`;
            });

            // 1. WhatsApp Notification
            if (hasWhatsApp) {
                // Find a WhatsApp account for this tenant
                const account = await prisma.connectedAccount.findFirst({
                    where: { tenantId: lead.tenantId, platform: 'WHATSAPP' }
                });

                if (account) {
                    const phoneNumberId = account.metadata?.phoneNumberId;
                    if (phoneNumberId) {
                        await whatsappService.sendTextMessage({
                            phoneNumberId,
                            to: lead.phone,
                            text: messageBody,
                            accessToken: account.accessToken
                        });
                    }
                }
            }

            // 2. Email Notification (Nurture)
            if (hasEmail) {
                // Use email service...
                console.log(`[LeadNurture] Sending property match email to ${lead.email}`);
            }

            // 3. Log Interaction
            await prisma.leadInteraction.create({
                data: {
                    tenantId: lead.tenantId,
                    leadId: lead.id,
                    type: 'PROPERTY_MATCH',
                    metadata: {
                        propertyIds: properties.map(p => p.id),
                        channels: ['WHATSAPP', 'EMAIL']
                    }
                }
            });

        } catch (error) {
            console.error('[LeadNurture] Notification error:', error);
        }
    }
}

module.exports = new LeadNurtureService();
