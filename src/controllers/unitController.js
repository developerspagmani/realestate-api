const { prisma } = require('../config/database');

// Create unit
const createUnit = async (req, res) => {
    try {
        const {
            propertyId,
            unitCategory,
            unitCode,
            slug: bodySlug,
            floorNo,
            capacity,
            sizeSqft,
            mainImageId,
            gallery
        } = req.body;

        const tenantId = req.body.tenantId || req.user?.tenantId || req.tenant?.id;

        if (!tenantId || !propertyId || !unitCategory) {
            return res.status(400).json({
                success: false,
                message: 'Required fields: tenantId, propertyId, unitCategory'
            });
        }

        // Generate slug if not provided
        const baseSlug = bodySlug || (unitCode ? unitCode.toLowerCase().replace(/[^a-z0-9]+/g, '-') : Math.random().toString(36).substr(2, 9));
        let uniqueSlug = baseSlug;
        let counter = 1;
        while (await prisma.unit.findUnique({ where: { slug: uniqueSlug } })) {
            uniqueSlug = `${baseSlug}-${counter++}`;
        }

        const unit = await prisma.unit.create({
            data: {
                tenantId,
                propertyId,
                unitCategory,
                unitCode,
                slug: uniqueSlug,
                floorNo: floorNo ? parseInt(floorNo) : null,
                capacity: capacity ? parseInt(capacity) : null,
                sizeSqft: sizeSqft ? parseInt(sizeSqft) : null,
                mainImageId: mainImageId || null,
                gallery: Array.isArray(gallery) ? gallery : [],
                status: 1 // 1: available
            }
        });

        // Real Estate Details
        const { realEstateDetails } = req.body;
        if (realEstateDetails) {
            const parseVal = (v) => (v !== undefined && v !== null && v !== '') ? parseInt(v) : null;
            await prisma.realEstateUnitDetails.create({
                data: {
                    unitId: unit.id,
                    bedrooms: parseVal(realEstateDetails.bedrooms),
                    bathrooms: parseVal(realEstateDetails.bathrooms),
                    furnishing: parseVal(realEstateDetails.furnishing),
                    parkingSlots: parseVal(realEstateDetails.parkingSlots),
                    facing: parseVal(realEstateDetails.facing)
                }
            });
        }

        // Create unit pricing
        const { hourlyRate, dailyRate, monthlyRate, price, currency } = req.body;
        const prices = [
            { pricingModel: 1, price: parseFloat(price) || 0 }, // Fixed / Sale
            { pricingModel: 2, price: parseFloat(hourlyRate) || 0 },
            { pricingModel: 3, price: parseFloat(dailyRate) || 0 },
            { pricingModel: 4, price: parseFloat(monthlyRate) || 0 }
        ].filter(p => p.price > 0);

        for (const p of prices) {
            await prisma.unitPricing.create({
                data: {
                    unitId: unit.id,
                    pricingModel: p.pricingModel,
                    price: p.price,
                    currency: currency || 'USD'
                }
            });
        }

        // Add default amenities for unit category
        const defaultAmenities = await getDefaultAmenities(unitCategory);
        for (const amenity of defaultAmenities) {
            await prisma.unitAmenity.create({
                data: {
                    unitId: unit.id,
                    amenityId: amenity.id
                }
            });
        }

        res.status(201).json({
            success: true,
            message: 'Unit created successfully',
            data: { unit }
        });
    } catch (error) {
        console.error('Create unit error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating unit'
        });
    }
};

// Get default amenities for unit category
const getDefaultAmenities = async (unit_category) => {
    const amenityMapping = {
        1: ['WiFi', 'Air Conditioning', 'Parking'], // Residential
        2: ['High-Speed Internet', 'Meeting Rooms', 'Kitchen'], // Commercial
        3: ['24/7 Access', 'Security', 'Storage'], // Industrial
        4: ['Reception', 'Mail Services', 'Cleaning'] // Mixed Use
    };

    const amenityNames = amenityMapping[unit_category] || [];

    const amenities = await prisma.amenity.findMany({
        where: {
            name: { in: amenityNames },
            status: 1 // Assuming 1 is active based on schema default
        }
    });

    return amenities;
};

// Get all units for tenant
const getUnits = async (req, res) => {
    try {
        const { page = 1, limit = 10, propertyId, unitCategory, status, tenantId: queryTenantId, ownerId } = req.query;
        const tenantId = queryTenantId || req.tenant?.id || req.user?.tenantId;

        if (!tenantId) {
            return res.status(400).json({
                success: false,
                message: 'Tenant ID is required'
            });
        }

        // Build where clause
        const where = {};

        // If propertyId is provided, it's the strongest filter and should show all units of that property for admins
        if (propertyId) {
            where.propertyId = propertyId;
            // For non-admins or specific restrictive views, we still want to ensure they belong to the tenant
            if (req.user.role !== 2 && tenantId) {
                where.tenantId = tenantId;
            }
        } else {
            // No propertyId, use tenant/owner filters
            if (tenantId) {
                where.tenantId = tenantId;
            }

            // Admin filtering by owner
            if (ownerId && req.user.role === 2) {
                where.property = {
                    userPropertyAccess: {
                        some: { userId: ownerId }
                    }
                };
            }
        }

        if (unitCategory) where.unitCategory = parseInt(unitCategory);
        if (status) where.status = parseInt(status);
        // Removed restrictive check for owners (role 3) to allow them to see all units in their tenant.

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [units, total] = await Promise.all([
            prisma.unit.findMany({
                where,
                include: {
                    mainImage: true,
                    realEstateDetails: true,
                    unitPricing: {
                        select: {
                            price: true,
                            currency: true,
                            pricingModel: true
                        }
                    },
                    unitAmenities: {
                        include: {
                            amenity: {
                                select: {
                                    name: true,
                                    category: true
                                }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit)
            }),
            prisma.unit.count({ where })
        ]);

        res.status(200).json({
            success: true,
            data: {
                units,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get units error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching units'
        });
    }
};

// Get unit by ID
const getUnitById = async (req, res) => {
    try {
        const { id } = req.params;
        const { tenantId: queryTenantId } = req.query;
        const tenantId = queryTenantId || req.tenant?.id || req.user?.tenantId;

        if (!tenantId) {
            return res.status(400).json({
                success: false,
                message: 'Tenant ID is required'
            });
        }

        const unit = await prisma.unit.findUnique({
            where: {
                id,
                tenantId
            },
            include: {
                mainImage: true,
                realEstateDetails: true,
                property: {
                    select: {
                        title: true,
                        addressLine1: true,
                        city: true,
                        state: true
                    }
                },
                unitPricing: {
                    select: {
                        price: true,
                        currency: true,
                        pricingModel: true
                    }
                },
                unitAmenities: {
                    include: {
                        amenity: {
                            select: {
                                name: true,
                                category: true
                            }
                        }
                    }
                }
            }
        });

        if (!unit) {
            return res.status(404).json({
                success: false,
                message: 'Unit not found'
            });
        }

        res.status(200).json({
            success: true,
            data: { unit }
        });
    } catch (error) {
        console.error('Get unit error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching unit'
        });
    }
};

// Update unit
const updateUnit = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.query.tenantId || req.body.tenantId || req.tenant?.id;
        const updateData = { ...req.body };
        const pricingData = updateData.unitPricing;
        delete updateData.unitPricing;
        delete updateData.id;
        delete updateData.tenantId;

        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'Tenant ID is required' });
        }

        if (updateData.mainImageId === '') updateData.mainImageId = null;
        if (updateData.gallery && !Array.isArray(updateData.gallery)) updateData.gallery = [];

        if (updateData.floorNo) updateData.floorNo = parseInt(updateData.floorNo);
        if (updateData.capacity) updateData.capacity = parseInt(updateData.capacity);
        if (updateData.sizeSqft) updateData.sizeSqft = parseInt(updateData.sizeSqft);
        if (updateData.unitCategory) updateData.unitCategory = parseInt(updateData.unitCategory);
        if (updateData.status) updateData.status = parseInt(updateData.status);

        // Extract root level individual rates if provided
        const { hourlyRate, dailyRate, monthlyRate, currency, price, pricingModel, realEstateDetails, unitAmenities } = updateData;
        delete updateData.hourlyRate;
        delete updateData.dailyRate;
        delete updateData.monthlyRate;
        delete updateData.currency;
        delete updateData.price;
        delete updateData.pricingModel;
        delete updateData.realEstateDetails;
        delete updateData.unitAmenities;

        console.log('Update Unit Request Debug:', {
            id,
            tenantId,
            mainImageId: updateData.mainImageId,
            gallery: updateData.gallery
        });

        const result = await prisma.$transaction(async (tx) => {
            const unit = await tx.unit.update({
                where: { id, tenantId },
                data: updateData
            });

            // Update Real Estate Details
            const { realEstateDetails: reDetails } = req.body;
            if (reDetails) {
                const parseVal = (v) => (v !== undefined && v !== null && v !== '') ? parseInt(v) : (v === null ? null : undefined);

                const existingRE = await tx.realEstateUnitDetails.findUnique({
                    where: { unitId: id }
                });

                const reData = {
                    bedrooms: parseVal(reDetails.bedrooms),
                    bathrooms: parseVal(reDetails.bathrooms),
                    furnishing: parseVal(reDetails.furnishing),
                    parkingSlots: parseVal(reDetails.parkingSlots),
                    facing: parseVal(reDetails.facing)
                };

                // Remove undefined values to avoid Prisma errors if we only want to update provided fields
                Object.keys(reData).forEach(key => reData[key] === undefined && delete reData[key]);

                if (existingRE) {
                    await tx.realEstateUnitDetails.update({
                        where: { unitId: id },
                        data: reData
                    });
                } else {
                    // For creation, we might want nulls instead of undefineds for missing fields
                    const createData = {
                        unitId: id,
                        bedrooms: parseVal(reDetails.bedrooms) ?? null,
                        bathrooms: parseVal(reDetails.bathrooms) ?? null,
                        furnishing: parseVal(reDetails.furnishing) ?? null,
                        parkingSlots: parseVal(reDetails.parkingSlots) ?? null,
                        facing: parseVal(reDetails.facing) ?? null
                    };
                    await tx.realEstateUnitDetails.create({
                        data: createData
                    });
                }
            }

            console.log('Update Unit Success:', unit.id);

            // Update individual rates if provided
            const ratesToUpdate = [
                { model: 1, val: price }, // Fixed / Sale
                { model: 2, val: hourlyRate },
                { model: 3, val: dailyRate },
                { model: 4, val: monthlyRate }
            ];

            for (const rate of ratesToUpdate) {
                if (rate.val !== undefined && rate.val !== null) {
                    const existing = await tx.unitPricing.findFirst({
                        where: { unitId: id, pricingModel: rate.model }
                    });

                    if (existing) {
                        await tx.unitPricing.update({
                            where: { id: existing.id },
                            data: {
                                price: parseFloat(rate.val),
                                currency: currency || existing.currency
                            }
                        });
                    } else {
                        await tx.unitPricing.create({
                            data: {
                                unitId: id,
                                pricingModel: rate.model,
                                price: parseFloat(rate.val),
                                currency: currency || 'USD'
                            }
                        });
                    }
                }
            }

            return unit;
        });

        res.status(200).json({
            success: true,
            message: 'Unit updated successfully',
            data: { unit: result }
        });
    } catch (error) {
        console.error('Update unit error:', error);
        res.status(500).json({ success: false, message: 'Error updating unit' });
    }
};

// Delete unit
const deleteUnit = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.query.tenantId || req.body.tenantId || req.tenant?.id;

        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'Tenant ID is required' });
        }

        await prisma.unit.delete({
            where: { id, tenantId }
        });

        res.status(200).json({
            success: true,
            message: 'Unit deleted successfully'
        });
    } catch (error) {
        console.error('Delete unit error:', error);
        res.status(500).json({ success: false, message: 'Error deleting unit' });
    }
};

module.exports = {
    createUnit,
    getUnits,
    getUnitById,
    updateUnit,
    deleteUnit
};