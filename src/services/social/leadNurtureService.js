const { prisma } = require('../../config/database');
const aiService = require('./aiService');
const propertyService = require('./propertyService');
const whatsappService = require('./whatsappService');
const emailService = require('../../utils/emailService');

/**
 * Unified Automation Hub Service
 * Handles Lead Matching, Nurturing, and Omni-channel notifications
 */
class LeadNurtureService {
    async enrichLeadPreferences(leadId, messageText, structuredData = {}, options = {}) {
        try {
            const lead = await prisma.lead.findUnique({ where: { id: leadId } });
            if (!lead) return;

            let extractedFilters = {};
            if (messageText) {
                // Extract filters using AI Service
                extractedFilters = await aiService.extractFilters(messageText);
            }

            // Combine with structured data (manual inputs from CRM)
            const combinedFilters = {
                ...extractedFilters,
                ...(structuredData.budget ? { maxPrice: Number(structuredData.budget) } : {}),
                ...(structuredData.location ? { location: structuredData.location } : {}),
                ...(structuredData.propertyType ? { propertyType: structuredData.propertyType } : {}),
                ...(structuredData.bedrooms ? { bedrooms: Number(structuredData.bedrooms) } : {})
            };

            if (Object.keys(combinedFilters).length > 0) {
                const currentPrefs = lead.preferences || {};
                await prisma.lead.update({
                    where: { id: lead.id },
                    data: {
                        preferences: {
                            ...currentPrefs,
                            ...combinedFilters,
                            isWaitingForMatch: true, // Mark as waiting
                            lastInteractionAt: new Date()
                        },
                        // Sync budget if not set
                        budget: combinedFilters.maxPrice && !lead.budget ? combinedFilters.maxPrice : lead.budget
                    }
                });

                console.log(`[LeadNurture] Enriched lead ${lead.id} with preferences:`, combinedFilters);

                // Immediately check if anything exists now
                if (!options.skipNotification) {
                    await this.checkMatchesForLead(lead.id);
                }
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
                console.log(`[LeadNurture] Sending property match email to ${lead.email}`);
                await emailService.sendPropertyRecommendationEmail(lead.email, lead.name, properties);
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

    /**
     * Handle logic after a lead is marked as Lost
     */
    async handleLeadLost(leadId, lossData) {
        try {
            const lead = await prisma.lead.findUnique({ where: { id: leadId } });
            if (!lead) return;

            console.log(`[LeadNurture] Handling post-loss logic for Lead ${leadId}. Reason: ${lossData.primaryReason}`);

            // 1. If reason = Budget -> Enable "Price Drop Alerts" in preferences
            if (lossData.primaryReason === 'Budget too high') {
                const currentPrefs = lead.preferences || {};
                await prisma.lead.update({
                    where: { id: leadId },
                    data: {
                        preferences: {
                            ...currentPrefs,
                            nurtureMode: 'FUTURE_BUDGET',
                            alertOnPriceDrop: true,
                            lastNurtureAction: 'LOST_FEEDBACK_CAPTURED'
                        }
                    }
                });
            }

            // 2. If reason = Timeline mismatch -> Auto-remind after 3 months (hypothetically schedule a task)
            if (lossData.primaryReason === 'Timeline mismatch') {
                // In a real system, we would add this to a job queue (BullMQ/agenda)
                // For now, we log it and mark it in preferences
                const currentPrefs = lead.preferences || {};
                await prisma.lead.update({
                    where: { id: leadId },
                    data: {
                        preferences: {
                            ...currentPrefs,
                            nurtureMode: 'LONG_TERM_FOLLOWUP',
                            followupAfterDays: 90
                        }
                    }
                });
            }

            // 3. Log interaction for the audit trail
            await prisma.leadInteraction.create({
                data: {
                    tenantId: lead.tenantId,
                    leadId: lead.id,
                    type: 'SYSTEM_EVENT',
                    metadata: {
                        event: 'DEAL_LOST_NURTURE_TRIGGERED',
                        reason: lossData.primaryReason,
                        timestamp: new Date()
                    }
                }
            });

        } catch (error) {
            console.error('[LeadNurture] handleLeadLost error:', error);
        }
    }
    /**
     * Smart Revival Engine: Scans and flags lost leads for re-engagement
     */
    async reviveLeadsOnPriceDrop(propertyId, newPrice) {
        try {
            console.log(`[LeadRevival] Price drop detected for property ${propertyId} to ${newPrice}. Scanning for lost leads...`);

            // Find leads lost for this property due to "Budget"
            const lostLeads = await prisma.lead.findMany({
                where: {
                    propertyId,
                    status: 5,
                    lossData: {
                        primaryReason: 'Budget too high'
                    }
                },
                include: { lossData: true }
            });

            for (const lead of lostLeads) {
                // If new price is within their budget or within a reasonable 10% overflow
                const leadBudget = Number(lead.budget) || 0;
                if (newPrice <= leadBudget * 1.1) {
                    await prisma.leadLossData.update({
                        where: { leadId: lead.id },
                        data: {
                            revivalStatus: 2, // QUEUED
                            revivalDate: new Date(),
                            notes: `${lead.lossData.notes || ''}\n[REVIVAL] Auto-flagged: Price dropped to ${newPrice}`
                        }
                    });

                    console.log(`[LeadRevival] Flagged Lead ${lead.id} (${lead.name}) for budget revival.`);
                }
            }
        } catch (error) {
            console.error('[LeadRevival] Price drop error:', error);
        }
    }

    async scanForRevivals(tenantId) {
        try {
            const now = new Date();
            // Find leads with "Timeline mismatch" lost more than 90 days ago
            const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

            const potentialRevivals = await prisma.leadLossData.findMany({
                where: {
                    tenantId,
                    revivalStatus: 1, // None
                    primaryReason: 'Timeline mismatch',
                    createdAt: { lt: threeMonthsAgo }
                }
            });

            for (const loss of potentialRevivals) {
                await prisma.leadLossData.update({
                    where: { id: loss.id },
                    data: {
                        revivalStatus: 2, // QUEUED
                        revivalDate: new Date(),
                        notes: `${loss.notes || ''}\n[REVIVAL] Time-based re-engagement trigger (90+ days passed)`
                    }
                });
            }

            return potentialRevivals.length;
        } catch (error) {
            console.error('[LeadRevival] Scan error:', error);
            return 0;
        }
    }
}

module.exports = new LeadNurtureService();
