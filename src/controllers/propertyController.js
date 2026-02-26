const { prisma } = require('../config/database');
const leadNurtureService = require('../services/social/leadNurtureService');

// Create property
const createProperty = async (req, res) => {
  try {
    const {
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
      amenities,
      yearBuilt,
      neighborhood,
      parkingSpaces,
      bedrooms,
      bathrooms,
      lotSize,
      listingType,
      categoryId,
      videoUrl,
      price
    } = req.body;

    const isAdmin = req.user.role === 2;
    // SEC-01 fix: Force tenantId from user context for non-admins to prevent IDOR
    const tenantId = (isAdmin && req.body.tenantId) ? req.body.tenantId : (req.tenant?.id || req.user?.tenantId);

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
          },
          yearBuilt: yearBuilt ? parseInt(yearBuilt) : null,
          neighborhood: neighborhood || null,
          parkingSpaces: parkingSpaces ? parseInt(parkingSpaces) : null,
          bedrooms: bedrooms ? parseInt(bedrooms) : null,
          bathrooms: bathrooms ? parseInt(bathrooms) : null,
          lotSize: lotSize ? parseInt(lotSize) : null,
          listingType: listingType || 'Rent',
          price: price ? parseFloat(price) : null,
          categoryId: categoryId && categoryId !== '' ? categoryId : null,
          videoUrl: videoUrl || null
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

    const leadNurtureService = require('../services/social/leadNurtureService');

    // Trigger proactive matching in background
    leadNurtureService.findMatchesForNewProperty(result.id).catch(err => {
      console.error('Error triggering matching engine:', err);
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
    const pageInt = parseInt(page) || 1;
    const limitInt = parseInt(limit) || 10;
    const skip = (pageInt - 1) * limitInt;

    const isAdmin = req.user.role === 2;
    // SEC-01 fix: Force tenantId from user context for non-admins to prevent IDOR
    const tenantId = (isAdmin && queryTenantId) ? queryTenantId : (isAdmin ? (queryTenantId || null) : (req.tenant?.id || req.user?.tenantId));

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
      where.tenant = { type: parseInt(industryType) };
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

    if (req.query.search) {
      where.OR = [
        { title: { contains: req.query.search, mode: 'insensitive' } },
        { city: { contains: req.query.search, mode: 'insensitive' } },
        { neighborhood: { contains: req.query.search, mode: 'insensitive' } }
      ];
    }

    // Owner/Admin filtering
    const effectiveOwnerId = isAdmin ? ownerId : (req.user.role === 3 ? req.user.id : null);

    if (effectiveOwnerId) {
      // Check if user has any specific property access defined
      // PERF: findFirst is faster than count for existence checks
      const accessRecord = await prisma.userPropertyAccess.findFirst({
        where: { userId: effectiveOwnerId, tenantId: tenantId || undefined },
        select: { id: true }
      });

      if (accessRecord) {
        where.userPropertyAccess = {
          some: { userId: effectiveOwnerId }
        };
      }
    }

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
    const isAdmin = req.user.role === 2;
    // SEC-01 fix: Force tenantId from user context for non-admins to prevent IDOR
    const tenantId = (isAdmin && queryTenantId) ? queryTenantId : (req.tenant?.id || req.user?.tenantId);

    const where = { id };
    if (tenantId) where.tenantId = tenantId;

    const property = await prisma.property.findFirst({
      where,
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
    const isAdmin = req.user.role === 2;
    // SEC-01 fix: Force tenantId from user context for non-admins to prevent IDOR
    const tenantId = (isAdmin && (req.query.tenantId || req.body.tenantId)) ? (req.query.tenantId || req.body.tenantId) : (req.tenant?.id || req.user?.tenantId);

    const {
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
      amenities,
      yearBuilt,
      neighborhood,
      parkingSpaces,
      bedrooms,
      bathrooms,
      lotSize,
      listingType,
      categoryId,
      videoUrl,
      price,
      metadata
    } = req.body;

    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const updateBody = {
      propertyType: propertyType ? parseInt(propertyType) : undefined,
      title,
      slug: bodySlug,
      description,
      addressLine1,
      addressLine2,
      city,
      state,
      country,
      postalCode,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      mainImageId: mainImageId === '' ? null : mainImageId,
      gallery: Array.isArray(gallery) ? gallery : undefined,
      status: status ? parseInt(status) : undefined,
      area: area ? parseInt(area) : undefined,
      floorPlanId: floorPlanId === '' ? null : floorPlanId,
      brochureId: brochureId === '' ? null : brochureId,
      yearBuilt: yearBuilt ? parseInt(yearBuilt) : undefined,
      neighborhood,
      parkingSpaces: parkingSpaces ? parseInt(parkingSpaces) : undefined,
      bedrooms: bedrooms ? parseInt(bedrooms) : undefined,
      bathrooms: bathrooms ? parseInt(bathrooms) : undefined,
      lotSize: lotSize ? parseInt(lotSize) : undefined,
      listingType,
      categoryId: (categoryId === '' || categoryId === 'null') ? null : categoryId,
      videoUrl,
      price: price ? parseFloat(price) : undefined,
      metadata
    };

    // Remove undefined fields to avoid overwriting with null/undefined if not provided
    Object.keys(updateBody).forEach(key => updateBody[key] === undefined && delete updateBody[key]);

    console.log('Final Update Body for Property:', id, JSON.stringify(updateBody, null, 2));

    // Get old price to check for drop
    const oldProperty = await prisma.property.findUnique({
      where: { id, tenantId },
      select: { price: true }
    });

    const property = await prisma.property.update({
      where: { id, tenantId },
      data: {
        ...updateBody,
        propertyAmenities: amenities ? {
          deleteMany: {},
          create: Array.isArray(amenities) ? [...new Set(amenities)].map(id => ({ amenityId: id })) : []
        } : undefined
      }
    });

    // Trigger revival if price dropped
    if (price && oldProperty && Number(price) < Number(oldProperty.price)) {
      setTimeout(() => leadNurtureService.reviveLeadsOnPriceDrop(id, Number(price)), 100);
    }

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
    const isAdmin = req.user.role === 2;
    // SEC-01 fix: Force tenantId from user context for non-admins to prevent IDOR
    const tenantId = (isAdmin && (req.query.tenantId || req.body.tenantId)) ? (req.query.tenantId || req.body.tenantId) : (req.tenant?.id || req.user?.tenantId);

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

module.exports = {
  createProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  deleteProperty
};
