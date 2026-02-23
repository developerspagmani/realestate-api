const { prisma } = require('../config/database');

const publicController = {
    // Get all properties (Listing)
    getProperties: async (req, res) => {
        try {
            const {
                tenantId,
                city,
                propertyType,
                minPrice,
                maxPrice,
                bedrooms,
                bathrooms,
                listingType,
                search,
                page = 1,
                limit = 50
            } = req.query;

            // Notice we REQUIRE tenantId for multi-tenancy isolation
            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Tenant ID is required for public discovery.' });
            }

            const pageInt = parseInt(page) || 1;
            const limitInt = parseInt(limit) || 50;
            const skip = (pageInt - 1) * limitInt;

            // Build complex filter
            const where = {
                tenantId,
                status: 1
            };

            if (city) where.city = { contains: city, mode: 'insensitive' };
            if (propertyType) where.propertyType = parseInt(propertyType);
            if (bedrooms) where.bedrooms = { gte: parseInt(bedrooms) };
            if (bathrooms) where.bathrooms = { gte: parseInt(bathrooms) };
            if (listingType) where.listingType = listingType;

            // Price filtering
            if (minPrice || maxPrice) {
                where.price = {};
                if (minPrice) where.price.gte = parseFloat(minPrice);
                if (maxPrice) where.price.lte = parseFloat(maxPrice);
            }

            // Keyword search
            if (search) {
                where.OR = [
                    { title: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                    { neighborhood: { contains: search, mode: 'insensitive' } },
                    { city: { contains: search, mode: 'insensitive' } }
                ];
            }

            // Log search/filter interaction for analytics
            if (search || city) {
                try {
                    // We need a valid leadId for the relation. Find or create a 'Public Visitor' system lead if not exists.
                    let systemLead = await prisma.lead.findFirst({
                        where: { tenantId, email: 'system@search.analytics' }
                    });

                    if (!systemLead) {
                        systemLead = await prisma.lead.create({
                            data: {
                                tenantId,
                                name: 'Public Search System',
                                email: 'system@search.analytics',
                                source: 6, // Other
                                status: 1, // New
                                notes: 'System lead for tracking public searches'
                            }
                        });
                    }

                    await prisma.leadInteraction.create({
                        data: {
                            tenantId,
                            leadId: systemLead.id,
                            type: 'SEARCH',
                            metadata: {
                                keyword: search || 'All',
                                city: city || 'Unknown',
                                filters: { propertyType, minPrice, maxPrice, bedrooms, bathrooms, listingType },
                                date: new Date()
                            },
                            scoreWeight: 0
                        }
                    });
                } catch (err) {
                    console.error('Search interaction logging failed:', err);
                }
            }

            const [properties, total] = await Promise.all([
                prisma.property.findMany({
                    where,
                    include: {
                        mainImage: true,
                        _count: {
                            select: { units: true }
                        },
                        units: {
                            include: {
                                unitPricing: true,
                                mainImage: true
                            },
                            take: 4 // Only need a few for preview
                        }
                    },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limitInt
                }),
                prisma.property.count({ where })
            ]);

            res.json({
                success: true,
                data: properties,
                pagination: {
                    total,
                    page: pageInt,
                    limit: limitInt,
                    pages: Math.ceil(total / limitInt)
                }
            });
        } catch (error) {
            console.error('Public Listing Error:', error);
            res.status(500).json({ success: false, message: 'Server error (listing)' });
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
                        include: {
                            unitPricing: true,
                            realEstateDetails: true,
                            unitAmenities: {
                                include: { amenity: true }
                            },
                            mainImage: true
                        }
                    },
                    floorPlan: true,
                    brochure: true,
                    propertyAmenities: {
                        include: { amenity: true }
                    }
                }
            });

            if (!property) {
                return res.status(404).json({ success: false, message: 'Property not found' });
            }

            // Resolve gallery media if they are IDs for property and units
            const allMediaIds = new Set();
            if (property.gallery && Array.isArray(property.gallery)) {
                property.gallery.forEach(item => { if (typeof item === 'string') allMediaIds.add(item); });
            }
            if (property.units && Array.isArray(property.units)) {
                property.units.forEach(u => {
                    if (u.gallery && Array.isArray(u.gallery)) {
                        u.gallery.forEach(item => { if (typeof item === 'string') allMediaIds.add(item); });
                    }
                });
            }

            if (allMediaIds.size > 0) {
                const resolvedMedia = await prisma.media.findMany({
                    where: { id: { in: Array.from(allMediaIds) } }
                });

                // Map back to property
                if (property.gallery && Array.isArray(property.gallery)) {
                    property.gallery = property.gallery.map(item => {
                        if (typeof item === 'string') return resolvedMedia.find(m => m.id === item) || item;
                        return item;
                    });
                }
                // Map back to units
                if (property.units && Array.isArray(property.units)) {
                    property.units.forEach(u => {
                        if (u.gallery && Array.isArray(u.gallery)) {
                            u.gallery = u.gallery.map(item => {
                                if (typeof item === 'string') return resolvedMedia.find(m => m.id === item) || item;
                                return item;
                            });
                        }
                    });
                }
            }

            res.json({ success: true, data: property });
        } catch (error) {
            console.error('Public Detail Error:', error);
            res.status(500).json({ success: false, message: 'Server error (detail)' });
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
                ...(resolvedPropertyId ? { propertyId: resolvedPropertyId } : {}),
                ...(tenantId ? { tenantId } : {}),
                ...(unitCategory ? { unitCategory: parseInt(unitCategory) } : {})
            };

            const units = await prisma.unit.findMany({
                where,
                include: {
                    unitPricing: true,
                    realEstateDetails: true,
                    mainImage: true,
                    unitAmenities: {
                        include: { amenity: true }
                    },
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

            // Resolve gallery media if they are IDs
            const allMediaIds = new Set();
            units.forEach(u => {
                if (u.gallery && Array.isArray(u.gallery)) {
                    u.gallery.forEach(item => { if (typeof item === 'string') allMediaIds.add(item); });
                }
            });

            if (allMediaIds.size > 0) {
                const resolvedMedia = await prisma.media.findMany({
                    where: { id: { in: Array.from(allMediaIds) } }
                });

                units.forEach(u => {
                    if (u.gallery && Array.isArray(u.gallery)) {
                        u.gallery = u.gallery.map(item => {
                            if (typeof item === 'string') return resolvedMedia.find(m => m.id === item) || item;
                            return item;
                        });
                    }
                });
            }

            res.json({ success: true, data: units });
        } catch (error) {
            console.error('Public Units Error:', error);
            res.status(500).json({ success: false, message: 'Server error (units)' });
        }
    },

    // Get single unit detail
    getUnitDetail: async (req, res) => {
        try {
            const { id } = req.params;

            // Check if id is UUID or slug
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
            const where = isUuid ? { id } : { slug: id };

            const unit = await prisma.unit.findFirst({
                where,
                include: {
                    unitPricing: true,
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
            res.status(500).json({ success: false, message: 'Server error (unit-detail)' });
        }
    },

    // Get widgets listing (Public but requires tenantId)
    getWidgets: async (req, res) => {
        try {
            const { tenantId } = req.query;

            if (!tenantId) {
                return res.status(400).json({ success: false, message: 'Tenant ID is required.' });
            }

            const widgets = await prisma.widget.findMany({
                where: {
                    tenantId,
                    status: 1
                },
                include: {
                    property: {
                        select: {
                            id: true,
                            title: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            res.json({ success: true, data: widgets });
        } catch (error) {
            console.error('Public Widgets Error:', error);
            res.status(500).json({ success: false, message: 'Server error (widgets)' });
        }
    },
};

module.exports = publicController;
