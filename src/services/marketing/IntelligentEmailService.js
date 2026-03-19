const { prisma } = require('../../config/database');
const PropertyMatchService = require('./PropertyMatchService');
const { sendPropertyRecommendationEmail } = require('../../utils/emailService');

class IntelligentEmailService {
    /**
     * Scan all tenants and send automated recommendations if enabled
     */
    static async processAutomatedEmails() {
        try {
            console.log('[IntelligentEmail] Starting automated scan...');
            const tenants = await prisma.tenant.findMany({
                include: {
                    tenantModules: {
                        where: { module: { slug: 'marketing_hub' } }
                    }
                }
            });

            for (const tenant of tenants) {
                const marketingModule = tenant.tenantModules[0];
                const config = marketingModule?.settings?.intelligentEmail;

                if (!config || !config.enabled) continue;

                await this.processTenantLeads(tenant.id, config);
            }
        } catch (error) {
            console.error('[IntelligentEmail] Main process error:', error);
        }
    }

    /**
     * Process leads for a specific tenant based on intelligent config
     */
    static async processTenantLeads(tenantId, config) {
        try {
            // Find active leads that haven't received an automated email recently
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - (config.frequency === 'Daily' ? 1 : config.frequency === 'Every 2 Days' ? 2 : 7));

            const leads = await prisma.lead.findMany({
                where: {
                    tenantId,
                    status: 1, // Active
                    budget: { gt: 0 },
                    OR: [
                        { interactions: { none: { type: 'EMAIL_SENT', occurredAt: { gte: lastWeek } } } },
                        { updatedAt: { gte: lastWeek } } // If they've been updated, they might need a new mix
                    ]
                },
                take: 50 // Batched processing
            });

            console.log(`[IntelligentEmail] Found ${leads.length} leads for tenant ${tenantId}`);

            for (const lead of leads) {
                await this.generateAndSend(lead, tenantId, config);
            }
        } catch (error) {
            console.error(`[IntelligentEmail] Error for tenant ${tenantId}:`, error);
        }
    }

    /**
     * Generate property mix and send email
     */
    static async generateAndSend(lead, tenantId, config) {
        try {
            const budget = Number(lead.budget);
            const variance = (config.budgetVariance || 15) / 100;

            // 1. Get Exact Matches (2)
            // If it's a test lead, use a direct query instead of preference-based recommendations
            let matches = [];
            if (lead.id === 'test-lead') {
                matches = await prisma.property.findMany({
                    where: {
                        tenantId,
                        status: 1,
                        units: { some: { status: 1, unitPricing: { some: { price: { lte: budget } } } } }
                    },
                    include: {
                        mainImage: { select: { url: true } },
                        units: {
                            where: { status: 1 },
                            include: { unitPricing: true },
                            take: 3
                        }
                    },
                    take: 2
                });
            } else {
                matches = await PropertyMatchService.getRecommendations(lead.id, tenantId, 2);
            }

            // Define property inclusions
            const propertyInclusions = {
                mainImage: { select: { url: true } },
                units: {
                    where: { status: 1 },
                    include: { unitPricing: true },
                    take: 3
                }
            };

            // 2. Get Up-Sell (1) - Higher budget
            const upsellRaw = await prisma.property.findMany({
                where: {
                    tenantId,
                    status: 1,
                    units: {
                        some: {
                            unitPricing: { some: { price: { gt: budget, lte: budget * (1 + variance) } } }
                        }
                    }
                },
                include: propertyInclusions,
                take: 1
            });

            // 3. Get Cross-Sell (1) - Different category
            const crossSellRaw = await prisma.property.findMany({
                where: {
                    tenantId,
                    status: 1,
                    categoryId: { not: lead.property?.categoryId || undefined },
                    units: {
                        some: {
                            unitPricing: { some: { price: { lte: budget } } }
                        }
                    }
                },
                include: propertyInclusions,
                take: 1
            });

            // Helper to format properties consistently
            const formatProp = (p) => ({
                ...p,
                units: p.units.map(u => ({
                    ...u,
                    price: u.unitPricing?.[0]?.price || 0
                }))
            });

            const finalMix = [
                ...matches.map(p => p.matchScore ? p : formatProp(p)), // matches from Service are already formatted
                ...upsellRaw.map(formatProp),
                ...crossSellRaw.map(formatProp)
            ].slice(0, 4);

            if (finalMix.length === 0) {
                console.log(`[IntelligentEmail] No properties found for lead ${lead.id} with budget ${budget}`);
                return;
            }

            // Fetch tenant info for branding and settings
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                include: {
                    tenantModules: {
                        where: { module: { slug: 'marketing_hub' } }
                    }
                }
            });

            const emailConfig = tenant.tenantModules[0]?.settings?.emailConfig || {};
            const currencySymbol = tenant.settings?.currencySymbol || '$';

            // Send Email
            const emailSent = await sendPropertyRecommendationEmail(
                lead.email,
                lead.name,
                finalMix,
                { 
                    name: tenant.name, 
                    customDomain: tenant.domain, 
                    currencySymbol,
                    ...emailConfig
                }
            );

            if (emailSent) {
                // Log interaction
                await prisma.leadInteraction.create({
                    data: {
                        tenantId,
                        leadId: lead.id,
                        type: 'EMAIL_SENT',
                        metadata: {
                            type: 'recommendation',
                            propertyCount: finalMix.length,
                            automation: true
                        },
                        scoreWeight: 0
                    }
                });
            }
        } catch (error) {
            console.error(`[IntelligentEmail] Failed for lead ${lead.id}:`, error);
        }
    }
}

module.exports = IntelligentEmailService;
