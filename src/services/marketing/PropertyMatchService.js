const { prisma } = require('../../config/database');

class PropertyMatchService {
    /**
     * Infer and update lead preferences based on their interactions
     */
    static async updateLeadPreferences(leadId) {
        try {
            const lead = await prisma.lead.findUnique({
                where: { id: leadId },
                include: {
                    interactions: {
                        where: {
                            type: { in: ['PROPERTY_VIEW', 'FORM_SUBMIT', 'CHAT_INIT', 'UNIT_VIEW'] }
                        },
                        orderBy: { occurredAt: 'desc' },
                        take: 20
                    }
                }
            });

            if (!lead || lead.interactions.length === 0) return null;

            // Extract property details from interactions
            const propertyIds = lead.interactions
                .filter(i => i.metadata && i.metadata.propertyId)
                .map(i => i.metadata.propertyId);

            if (propertyIds.length === 0) return null;

            const properties = await prisma.property.findMany({
                where: { id: { in: propertyIds } },
                include: {
                    units: {
                        include: { unitPricing: true }
                    }
                }
            });

            // Calculate preferences
            const locations = [...new Set(properties.map(p => p.city).filter(Boolean))];
            const propertyTypes = [...new Set(properties.map(p => p.propertyType).filter(Boolean))];

            // Handle average budget from viewed properties if not explicitly set
            const prices = properties.flatMap(p =>
                p.units.flatMap(u =>
                    u.unitPricing.map(up => Number(up.price))
                )
            ).filter(p => p > 0);
            const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null;

            const currentPrefs = typeof lead.preferences === 'string' ? JSON.parse(lead.preferences) : (lead.preferences || {});

            const updatedPrefs = {
                ...currentPrefs,
                interpretedLocations: locations,
                interpretedTypes: propertyTypes,
                suggestedMaxBudget: avgPrice ? avgPrice * 1.2 : currentPrefs.suggestedMaxBudget,
                lastProcessedAt: new Date()
            };

            return await prisma.lead.update({
                where: { id: leadId },
                data: { preferences: updatedPrefs }
            });
        } catch (error) {
            console.error('Update lead preferences error:', error);
            return null;
        }
    }

    /**
     * Get property recommendations for a lead
     */
    static async getRecommendations(leadId, tenantId, limit = 5) {
        try {
            const lead = await prisma.lead.findUnique({ where: { id: leadId } });
            if (!lead) return [];

            // Use provided tenantId or fallback to lead's own tenantId
            const targetTenantId = tenantId || lead.tenantId;
            if (!targetTenantId) return [];

            const prefs = typeof lead.preferences === 'string' ? JSON.parse(lead.preferences) : (lead.preferences || {});
            const budget = lead.budget && Number(lead.budget) > 0 ? Number(lead.budget) : (prefs.suggestedMaxBudget || 1000000);

            const hasPrefs = (prefs.interpretedLocations?.length > 0 || prefs.interpretedTypes?.length > 0);

            // Build matching query
            const recommendations = await prisma.property.findMany({
                where: {
                    tenantId: targetTenantId,
                    status: 1, // Active
                    AND: [
                        hasPrefs ? {
                            OR: [
                                { city: { in: prefs.interpretedLocations || [] } },
                                { propertyType: { in: prefs.interpretedTypes || [] } }
                            ]
                        } : {},
                        {
                            units: {
                                some: {
                                    status: 1, // Available
                                    unitPricing: {
                                        some: {
                                            price: { lte: budget }
                                        }
                                    }
                                }
                            }
                        }
                    ]
                },
                include: {
                    units: {
                        where: { status: 1 },
                        include: {
                            unitPricing: {
                                take: 1,
                                orderBy: { price: 'asc' }
                            }
                        },
                        take: 3
                    }
                },
                take: limit + 5 // Take slightly more to sort better
            });

            // Flatten prices for frontend and score recommendations
            return recommendations.map(p => {
                // Flatten price onto the unit objects for UI
                const unitsWithPrice = p.units.map(u => ({
                    ...u,
                    price: u.unitPricing?.[0]?.price || 0
                })).sort((a, b) => Number(a.price) - Number(b.price));

                let matchScore = 0;

                // Baseline score for matched properties
                matchScore += 10;

                if (prefs.interpretedLocations?.includes(p.city)) matchScore += 40;
                if (prefs.interpretedTypes?.includes(p.propertyType)) matchScore += 30;

                // Budget fit scoring
                const minUnitPrice = unitsWithPrice.length > 0
                    ? Math.min(...unitsWithPrice.map(u => Number(u.price)))
                    : 0;

                if (minUnitPrice > 0 && minUnitPrice <= budget) {
                    matchScore += 20;
                }

                return {
                    ...p,
                    units: unitsWithPrice,
                    matchScore: Math.min(matchScore, 100)
                };
            })
                .sort((a, b) => b.matchScore - a.matchScore)
                .slice(0, limit);

        } catch (error) {
            console.error('Get recommendations error:', error);
            return [];
        }
    }
}

module.exports = PropertyMatchService;
