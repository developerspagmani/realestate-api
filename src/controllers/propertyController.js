const { prisma } = require('../config/database');

// Create property
const createProperty = async (req, res) => {
  try {
    const {
      tenantId,
      propertyType,
      title,
      slug: bodySlug,
      description,
      addressLine1,
      addressLine2,
      city,
      state,
      country,
      postalCode,
      latitude,
      longitude,
      mainImageId,
      gallery,
      status,
      area,
      floorPlanId,
      brochureId,
      amenities
    } = req.body;

    if (!tenantId || !propertyType || !title || !city || !state) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: tenantId, propertyType, title, city, state'
      });
    }

    // Generate slug if not provided
    const baseSlug = bodySlug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let uniqueSlug = baseSlug;
    let counter = 1;
    while (await prisma.property.findUnique({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${baseSlug}-${counter++}`;
    }

    const result = await prisma.$transaction(async (tx) => {
      const property = await tx.property.create({
        data: {
          tenantId,
          propertyType,
          title,
          slug: uniqueSlug,
          description,
          addressLine1,
          addressLine2: addressLine2 || null,
          city,
          state,
          country: country || 'Default',
          postalCode,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          mainImageId: mainImageId || null,
          gallery: Array.isArray(gallery) ? gallery : [],
          status: status ? parseInt(status) : 1, // 1: active
          area: area ? parseInt(area) : null,
          floorPlanId: floorPlanId || null,
          brochureId: brochureId || null,
          propertyAmenities: {
            create: Array.isArray(amenities) ? [...new Set(amenities)].map(id => ({ amenityId: id })) : []
          }
        }
      });

      // Automatically grant access to the creator if they are an owner or admin
      if (req.user && (req.user.role === 3 || req.user.role === 2)) {
        await tx.userPropertyAccess.create({
          data: {
            tenantId,
            userId: req.user.id,
            propertyId: property.id,
            accessLevel: 3 // Admin access
          }
        });
      }

      return property;
    });

    res.status(201).json({
      success: true,
      message: 'Property created successfully',
      data: { property: result }
    });
  } catch (error) {
    console.error('Create property error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating property'
    });
  }
};

// Get all properties for tenant
const getProperties = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, city, state, propertyType, tenantId: queryTenantId, ownerId, industryType, agentId } = req.query;
    const isAdmin = req.user.role === 2;
    const tenantId = queryTenantId || req.tenant?.id || (isAdmin ? null : req.user?.tenantId);
    if (!tenantId && !isAdmin && !industryType) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID or Industry Type is required'
      });
    }

    // Build where clause
    const where = {};
    if (tenantId) where.tenantId = tenantId;

    if (industryType) {
      where.tenantId = parseInt(industryType);
    }

    if (status) where.status = parseInt(status);
    if (city) where.city = city;
    if (state) where.state = state;
    if (propertyType) where.propertyType = parseInt(propertyType);

    if (agentId) {
      where.agentProperties = {
        some: { agentId }
      };
    }

    // Owner/Admin filtering
    const effectiveOwnerId = isAdmin ? ownerId : (req.user.role === 3 ? req.user.id : null);

    if (effectiveOwnerId) {
      // Check if user has any specific property access defined
      const hasAccessRecords = await prisma.userPropertyAccess.count({
        where: { userId: effectiveOwnerId, tenantId }
      });

      if (hasAccessRecords > 0) {
        where.userPropertyAccess = {
          some: { userId: effectiveOwnerId }
        };
      }
    }

    const pageInt = parseInt(page) || 1;
    const limitInt = parseInt(limit) || 10;
    const skip = (pageInt - 1) * limitInt;

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        include: {
          mainImage: true,
          propertyAmenities: {
            include: {
              amenity: true
            }
          },
          units: {
            select: {
              id: true,
              unitCategory: true,
              capacity: true,
              status: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitInt
      }),
      prisma.property.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        properties,
        pagination: {
          page: pageInt,
          limit: limitInt,
          total,
          pages: Math.ceil(total / limitInt)
        }
      }
    });
  } catch (error) {
    console.error('Get properties error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching properties'
    });
  }
};

// Get property by ID
const getPropertyById = async (req, res) => {
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

    const property = await prisma.property.findUnique({
      where: {
        id,
        tenantId
      },
      include: {
        mainImage: true,
        floorPlan: true,
        brochure: true,
        propertyAmenities: {
          include: { amenity: true }
        },
        units: {
          select: {
            id: true,
            unitCategory: true,
            unitCode: true,
            capacity: true,
            sizeSqft: true,
            status: true
          }
        }
      }
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { property }
    });
  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching property'
    });
  }
};

// Update property
const updateProperty = async (req, res) => {
  try {
    const { id } = req.params;
    let tenantId = req.query.tenantId || req.body.tenantId || req.tenant?.id;
    const updateData = { ...req.body };
    const amenities = updateData.amenities;
    delete updateData.id;
    delete updateData.tenantId;
    delete updateData.amenities;

    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    if (updateData.mainImageId === '') updateData.mainImageId = null;
    if (updateData.gallery && !Array.isArray(updateData.gallery)) updateData.gallery = [];
    if (updateData.area) updateData.area = parseInt(updateData.area);
    if (updateData.floorPlanId === '') updateData.floorPlanId = null;
    if (updateData.brochureId === '') updateData.brochureId = null;

    console.log('Update Property Request Debug:', {
      id,
      tenantId,
      mainImageId: updateData.mainImageId,
      gallery: updateData.gallery
    });

    const property = await prisma.property.update({
      where: { id, tenantId },
      data: {
        ...updateData,
        propertyAmenities: amenities ? {
          deleteMany: {},
          create: Array.isArray(amenities) ? [...new Set(amenities)].map(id => ({ amenityId: id })) : []
        } : undefined
      }
    });

    console.log('Update Property Success:', property.id);

    res.status(200).json({
      success: true,
      message: 'Property updated successfully',
      data: { property }
    });
  } catch (error) {
    console.error('Update property error:', error);
    res.status(500).json({ success: false, message: 'Error updating property' });
  }
};

// Delete property
const deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.query.tenantId || req.body.tenantId || req.tenant?.id;

    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    await prisma.property.delete({
      where: { id, tenantId }
    });

    res.status(200).json({
      success: true,
      message: 'Property deleted successfully'
    });
  } catch (error) {
    console.error('Delete property error:', error);
    res.status(500).json({ success: false, message: 'Error deleting property' });
  }
};

// Create unit
const createUnit = async (req, res) => {
  try {
    const {
      tenantId,
      propertyId,
      unitCategory,
      unitCode,
      floorNo,
      capacity,
      sizeSqft,
      mainImageId,
      gallery
    } = req.body;

    if (!tenantId || !propertyId || !unitCategory) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: tenantId, propertyId, unitCategory'
      });
    }

    const unit = await prisma.unit.create({
      data: {
        tenantId,
        propertyId,
        unitCategory,
        unitCode,
        floorNo,
        capacity,
        sizeSqft,
        mainImageId,
        gallery,
        status: 1 // 1: available
      }
    });

    // Create unit pricing
    const { pricingModel, price, currency } = req.body;
    await prisma.unitPricing.create({
      data: {
        unitId: unit.id,
        pricingModel,
        price,
        currency: currency || 'USD'
      }
    });

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

  const amenities = await prisma.amenities.findMany({
    where: {
      name: { in: amenityNames },
      status: 'active'
    }
  });

  return amenities;
};

// Get all units for tenant
const getUnits = async (req, res) => {
  try {
    const { page = 1, limit = 10, propertyId, unitCategory, status, tenantId: queryTenantId, industryType, ownerId } = req.query;
    const tenantId = queryTenantId || req.tenant?.id || req.user?.tenantId;
    const isAdmin = req.user.role === 2;

    if (!tenantId && !isAdmin && !industryType) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID or Industry Type is required'
      });
    }

    // Build where clause
    const where = {};
    if (tenantId) where.tenantId = tenantId;

    if (industryType) {
      where.tenant = {
        type: parseInt(industryType)
      };
    }

    if (ownerId && isAdmin) {
      where.property = {
        userPropertyAccess: {
          some: { userId: ownerId }
        }
      };
    }

    if (propertyId) where.propertyId = propertyId;
    if (unitCategory) where.unitCategory = parseInt(unitCategory);
    if (status) where.status = parseInt(status);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [units, total] = await Promise.all([
      prisma.unit.findMany({
        where,
        include: {
          mainImage: true,
          unitPricing: {
            select: {
              price: true,
              currency: true
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
    const { tenantId } = req.query;

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

    const result = await prisma.$transaction(async (tx) => {
      const unit = await tx.unit.update({
        where: { id, tenantId },
        data: updateData
      });

      if (pricingData && pricingData.length > 0) {
        // Simple update for the first pricing record
        const firstPricing = pricingData[0];
        await tx.unitPricing.updateMany({
          where: { unitId: id },
          data: {
            price: firstPricing.price,
            pricingModel: firstPricing.pricingModel,
            currency: firstPricing.currency
          }
        });
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
  createProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  createUnit,
  getUnits,
  getUnitById,
  updateUnit,
  deleteUnit
};
