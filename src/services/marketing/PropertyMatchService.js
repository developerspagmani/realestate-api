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
                            type: { in: ['PROPERTY_VIEW', 'FORM_SUBMIT', 'CHAT_INIT', 'UNIT_VIEW', 'CHAT_CHOICE'] }
                        },
                        orderBy: { occurredAt: 'desc' },
                        take: 30
                    }
                }
            });

            if (!lead || lead.interactions.length === 0) return null;

            // Extract explicit preferences from CHAT_CHOICE
            const chatChoices = lead.interactions.filter(i => i.type === 'CHAT_CHOICE' && i.metadata);
            const explicitLocations = chatChoices.filter(i => i.metadata.step === 'LOCATION' || i.metadata.step === 'CITY').flatMap(i => Array.isArray(i.metadata.answer) ? i.metadata.answer : [i.metadata.answer]);
            const explicitTypes = chatChoices.filter(i => i.metadata.step === 'TYPE').flatMap(i => Array.isArray(i.metadata.answer) ? i.metadata.answer : [i.metadata.answer]);
            const explicitBudgetRaw = chatChoices.find(i => i.metadata.step === 'BUDGET')?.metadata.answer;
            const explicitBedrooms = chatChoices.find(i => i.metadata.step === 'BEDROOMS')?.metadata.answer;

            // Extract property details from viewing interactions
            const propertyIds = lead.interactions
                .filter(i => i.metadata && i.metadata.propertyId)
                .map(i => i.metadata.propertyId);

            const viewedProperties = propertyIds.length > 0 ? await prisma.property.findMany({
                where: { id: { in: propertyIds } },
                include: {
                    units: {
                        include: { unitPricing: true }
                    }
                }
            }) : [];

            // Interpret Preferences
            const locations = [
                ...new Set([
                    ...explicitLocations,
                    ...viewedProperties.map(p => p.city)
                ])
            ].filter(Boolean);

            const typeMap = {
                'Apartment': 1,
                'Villa': 1,
                'Residential': 1,
                'Office': 2,
                'Commercial': 2,
                'Industrial': 3,
                'Studio': 1
            };

            const propertyTypes = [
                ...new Set([
                    ...explicitTypes.map(t => typeof typeMap[t] !== 'undefined' ? typeMap[t] : Number(t)),
                    ...viewedProperties.map(p => p.propertyType)
                ])
            ].filter(v => v !== null && v !== undefined && !isNaN(Number(v))).map(Number);

            // Handle budget
            let suggestedBudget = null;
            if (explicitBudgetRaw) {
                const b = Array.isArray(explicitBudgetRaw) ? explicitBudgetRaw[0] : explicitBudgetRaw;
                if (b.includes('10k')) suggestedBudget = 15000;
                else if (b.includes('5k')) suggestedBudget = 8000;
                else if (b.includes('1k')) suggestedBudget = 3000;
                else suggestedBudget = 1000;
            } else {
                const prices = viewedProperties.flatMap(p =>
                    p.units.flatMap(u =>
                        u.unitPricing.map(up => Number(up.price))
                    )
                ).filter(p => p > 0);
                suggestedBudget = prices.length > 0 ? (prices.reduce((a, b) => a + b, 0) / prices.length) * 1.2 : null;
            }

            const currentPrefs = typeof lead.preferences === 'string' ? JSON.parse(lead.preferences) : (lead.preferences || {});

            const updatedPrefs = {
                ...currentPrefs,
                interpretedLocations: locations,
                interpretedTypes: propertyTypes,
                suggestedMaxBudget: suggestedBudget || currentPrefs.suggestedMaxBudget,
                explicitBedrooms: explicitBedrooms || currentPrefs.explicitBedrooms,
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
                                { city: { in: (prefs.interpretedLocations || []).map(String) } },
                                { propertyType: { in: (prefs.interpretedTypes || []).map(Number).filter(n => !isNaN(n)) } }
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
                    mainImage: { select: { url: true } },
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

                if (prefs.interpretedLocations?.map(String).includes(String(p.city))) matchScore += 30;
                if (prefs.interpretedTypes?.map(Number).includes(Number(p.propertyType))) matchScore += 20;

                // Explicit bedroom match (High Priority)
                if (prefs.explicitBedrooms) {
                    const reqBeds = parseInt(prefs.explicitBedrooms);
                    if (p.bedrooms === reqBeds) matchScore += 30;
                    else if (Math.abs((p.bedrooms || 0) - reqBeds) <= 1) matchScore += 10;
                }

                // Budget fit scoring
                const minUnitPrice = unitsWithPrice.length > 0
                    ? Math.min(...unitsWithPrice.map(u => Number(u.price)))
                    : 0;

                if (minUnitPrice > 0 && minUnitPrice <= budget) {
                    matchScore += 10;
                    // Extra points for closeness to budget
                    if (minUnitPrice >= budget * 0.7) matchScore += 10;
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
