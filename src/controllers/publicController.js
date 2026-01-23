const { prisma } = require('../config/database');

const publicController = {
    // Get all properties (Listing)
    getProperties: async (req, res) => {
        try {
            const { tenantId, city, propertyType } = req.query;

            // Notice we REQUIRE tenantId for multi-tenancy isolation
            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Tenant ID is required for public discovery.' });
            }

            const properties = await prisma.property.findMany({
                where: {
                    tenantId,
                    status: 1,
                    ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
                    ...(propertyType ? { propertyType: parseInt(propertyType) } : {})
                },
                include: {
                    mainImage: true,
                    _count: {
                        select: { units: true }
                    },
                    units: {
                        where: { status: 1 },
                        include: {
                            unitPricing: true,
                            mainImage: true
                        },
                        take: 4 // Only need a few for preview
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 50
            });

            res.json({ success: true, data: properties });
        } catch (error) {
            console.error('Public Listing Error:', error);
            res.status(500).json({ success: false, message: 'Server error (listing)', debug: error.message });
        }
    },

    // Get property detail (including units and 3D config)
    getPropertyDetail: async (req, res) => {
        try {
            const { id } = req.params;

            // Check if id is UUID or slug
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
            const where = isUuid ? { id, status: 1 } : { slug: id, status: 1 };

            const property = await prisma.property.findFirst({
                where,
                include: {
                    mainImage: true,
                    workspace3D: {
                        where: { status: 1 }
                    },
                    units: {
                        where: { status: 1 },
                        include: {
                            unitPricing: true,
                            coworkingDetails: true,
                            mainImage: true
                        }
                    }
                }
            });

            if (!property) {
                return res.status(404).json({ success: false, message: 'Property not found' });
            }

            // Resolve gallery media if they are IDs
            if (property.gallery && Array.isArray(property.gallery)) {
                const mediaIds = property.gallery.filter(item => typeof item === 'string');
                if (mediaIds.length > 0) {
                    const resolvedMedia = await prisma.media.findMany({
                        where: { id: { in: mediaIds } }
                    });
                    property.gallery = property.gallery.map(item => {
                        if (typeof item === 'string') {
                            return resolvedMedia.find(m => m.id === item) || item;
                        }
                        return item;
                    });
                }
            }

            res.json({ success: true, data: property });
        } catch (error) {
            console.error('Public Detail Error:', error);
            res.status(500).json({ success: false, message: 'Server error (detail)', debug: error.message });
        }
    },

    // Get units listing
    getUnits: async (req, res) => {
        try {
            const { propertyId, unitCategory, tenantId } = req.query;

            // Allow fetching by tenantId if propertyId is not provided (for "All Units" page)
            if (!propertyId && !tenantId) {
                return res.status(400).json({ success: false, message: 'Property ID or Tenant ID is required.' });
            }

            let resolvedPropertyId = propertyId;
            if (propertyId) {
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyId);
                if (!isUuid) {
                    const prop = await prisma.property.findFirst({
                        where: { slug: propertyId },
                        select: { id: true }
                    });
                    if (!prop) {
                        return res.json({ success: true, data: [] }); // Or 404, but empty list is safer for listings
                    }
                    resolvedPropertyId = prop.id;
                }
            }

            const where = {
                status: 1, // Available
                ...(resolvedPropertyId ? { propertyId: resolvedPropertyId } : {}),
                ...(tenantId ? { tenantId } : {}),
                ...(unitCategory ? { unitCategory: parseInt(unitCategory) } : {})
            };

            const units = await prisma.unit.findMany({
                where,
                include: {
                    unitPricing: true,
                    coworkingDetails: true,
                    mainImage: true,
                    property: {
                        select: {
                            id: true,
                            title: true, // Need property title for list view
                            slug: true,
                            city: true
                        }
                    }
                }
            });

            res.json({ success: true, data: units });
        } catch (error) {
            console.error('Public Units Error:', error);
            res.status(500).json({ success: false, message: 'Server error (units)', debug: error.message });
        }
    },

    // Get single unit detail
    getUnitDetail: async (req, res) => {
        try {
            const { id } = req.params;

            // Check if id is UUID or slug
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
            const where = isUuid ? { id, status: 1 } : { slug: id, status: 1 };

            const unit = await prisma.unit.findFirst({
                where,
                include: {
                    unitPricing: true,
                    coworkingDetails: true,
                    realEstateDetails: true,
                    mainImage: true,
                    property: {
                        include: {
                            mainImage: true
                        }
                    },
                    unitAmenities: {
                        include: {
                            amenity: true
                        }
                    }
                }
            });

            if (!unit) {
                return res.status(404).json({ success: false, message: 'Unit not found' });
            }

            // Resolve gallery media if they are IDs
            if (unit.gallery && Array.isArray(unit.gallery)) {
                const mediaIds = unit.gallery.filter(item => typeof item === 'string');
                if (mediaIds.length > 0) {
                    const resolvedMedia = await prisma.media.findMany({
                        where: { id: { in: mediaIds } }
                    });
                    unit.gallery = unit.gallery.map(item => {
                        if (typeof item === 'string') {
                            return resolvedMedia.find(m => m.id === item) || item;
                        }
                        return item;
                    });
                }
            }

            res.json({ success: true, data: unit });
        } catch (error) {
            console.error('Public Unit Detail Error:', error);
            res.status(500).json({ success: false, message: 'Server error (unit-detail)', debug: error.message });
        }
    },
};

module.exports = publicController;
