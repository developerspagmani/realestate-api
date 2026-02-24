const { prisma } = require('../../config/database');

/**
 * Property Service for Social/WhatsApp integrations
 */
class PropertyService {
    /**
     * Search properties based on various filters
     */
    async searchProperties(filters, tenantId) {
        try {
            const where = { tenantId, status: 1 }; // Status 1 = Active

            if (filters.location) {
                where.OR = [
                    { city: { contains: filters.location, mode: 'insensitive' } },
                    { state: { contains: filters.location, mode: 'insensitive' } },
                    { neighborhood: { contains: filters.location, mode: 'insensitive' } },
                    { addressLine1: { contains: filters.location, mode: 'insensitive' } }
                ];
            }

            if (filters.propertyType) {
                const typeMap = {
                    'residential': 1,
                    'commercial': 2,
                    'industrial': 3,
                    'mixed': 4,
                    'villa': 1,
                    'apartment': 1,
                    'house': 1,
                    'studio': 1,
                    'penthouse': 1
                };

                const typeValue = typeMap[filters.propertyType.toLowerCase()];
                if (typeValue) where.propertyType = typeValue;
            }

            if (filters.bedrooms) {
                where.bedrooms = { gte: filters.bedrooms };
            }

            // Price filtering via Units and UnitPricing
            if (filters.minPrice || filters.maxPrice) {
                where.units = {
                    some: {
                        unitPricing: {
                            some: {
                                price: {
                                    ...(filters.minPrice ? { gte: filters.minPrice } : {}),
                                    ...(filters.maxPrice ? { lte: filters.maxPrice } : {})
                                }
                            }
                        }
                    }
                };
            }

            const properties = await prisma.property.findMany({
                where,
                include: {
                    mainImage: true,
                    category: true,
                    workspace3D: true, // To check for 3D tours
                    units: {
                        include: {
                            unitPricing: true
                        }
                    }
                },
                take: 5,
                orderBy: { createdAt: 'desc' }
            });

            return properties;
        } catch (error) {
            console.error('Search properties error:', error);
            return [];
        }
    }

    /**
     * Format a property into a concise string for WhatsApp
     */
    formatPropertyMessage(property) {
        let details = `🏠 *${property.title}*\n`;

        // Get price range from units
        let minPrice = null;
        let maxPrice = null;

        if (property.units && property.units.length > 0) {
            property.units.forEach(unit => {
                unit.unitPricing?.forEach(pricing => {
                    const price = Number(pricing.price);
                    if (minPrice === null || price < minPrice) minPrice = price;
                    if (maxPrice === null || price > maxPrice) maxPrice = price;
                });
            });
        }

        if (minPrice !== null) {
            const formatPrice = (p) => {
                if (p >= 10000000) return `₹${(p / 10000000).toFixed(2)} Cr`;
                if (p >= 100000) return `₹${(p / 100000).toFixed(2)} Lacs`;
                return `₹${p.toLocaleString()}`;
            };

            if (minPrice === maxPrice) {
                details += `💰 *${formatPrice(minPrice)}*\n`;
            } else {
                details += `💰 *${formatPrice(minPrice)} - ${formatPrice(maxPrice)}*\n`;
            }
        }

        if (property.bedrooms) details += `🛏️ ${property.bedrooms} BHK | `;
        if (property.bathrooms) details += `🚿 ${property.bathrooms} Bath | `;
        if (property.area) details += `📏 ${property.area} sqft\n`;

        details += `📍 ${property.city}, ${property.state}\n`;

        if (property.neighborhood) details += `🏢 ${property.neighborhood}\n`;

        const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'https://www.app.virpanix.com';
        details += `\n🔗 View Details: ${rootDomain}/p/${property.slug}`;

        if (property.workspace3D) {
            details += `\n✨ *3D Tour Available:* ${rootDomain}/3d-tour/${property.slug}`;
        }

        details += `\n\nTo book a visit, reply with: *Book ${property.title.split(' ')[0]}*`;

        return details;
    }
}

module.exports = new PropertyService();
