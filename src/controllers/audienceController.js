const { prisma } = require('../config/database');

// Get all audience groups
const getAllAudienceGroups = async (req, res) => {
    try {
        const isAdmin = req.user.role === 2;
        const tenantId = (isAdmin && req.query.tenantId) ? req.query.tenantId : (req.tenant?.id || req.user?.tenantId);

        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'Tenant ID is required' });
        }

        const groups = await prisma.audienceGroup.findMany({
            where: { tenantId },
            include: {
                _count: {
                    select: { leads: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({ success: true, data: groups });
    } catch (error) {
        console.error('Get all audience groups error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching audience groups' });
    }
};

// Get single audience group by ID
const getAudienceGroupById = async (req, res) => {
    try {
        const { id } = req.params;
        const isAdmin = req.user.role === 2;
        const tenantId = (isAdmin && req.query.tenantId) ? req.query.tenantId : (req.tenant?.id || req.user?.tenantId);

        const group = await prisma.audienceGroup.findFirst({
            where: { id, tenantId },
            include: {
                leads: {
                    select: { id: true, name: true, email: true }
                },
                _count: {
                    select: { leads: true }
                }
            }
        });

        if (!group) {
            return res.status(404).json({ success: false, message: 'Audience group not found' });
        }

        res.status(200).json({ success: true, data: group });
    } catch (error) {
        console.error('Get audience group by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching audience group' });
    }
};

// Create audience group
const createAudienceGroup = async (req, res) => {
    try {
        const isAdmin = req.user.role === 2;
        const tenantId = (isAdmin && req.body.tenantId) ? req.body.tenantId : (req.tenant?.id || req.user?.tenantId);
        const { name, description, isDynamic, filters, leadIds, propertyId, listingId } = req.body;

        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'Tenant ID is required' });
        }

        // Combine property info into filters for storage
        const extendedFilters = {
            ...(filters || {}),
            propertyId: propertyId || listingId
        };

        const group = await prisma.audienceGroup.create({
            data: {
                name,
                description,
                isDynamic: !!isDynamic,
                filters: extendedFilters,
                tenantId,
                leads: leadIds && leadIds.length > 0 ? {
                    connect: await prisma.lead.findMany({
                        where: { id: { in: leadIds }, tenantId },
                        select: { id: true }
                    })
                } : undefined
            },
            include: {
                _count: {
                    select: { leads: true }
                }
            }
        });

        res.status(201).json({ success: true, message: 'Audience group created successfully', data: group });
    } catch (error) {
        console.error('Create audience group error:', error);
        res.status(500).json({ success: false, message: 'Server error creating audience group' });
    }
};

// Delete audience group
const deleteAudienceGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const isAdmin = req.user.role === 2;
        const tenantId = (isAdmin && req.query.tenantId) ? req.query.tenantId : (req.tenant?.id || req.user?.tenantId);

        await prisma.audienceGroup.deleteMany({
            where: { id, tenantId }
        });

        res.status(200).json({ success: true, message: 'Audience group deleted successfully' });
    } catch (error) {
        console.error('Delete audience group error:', error);
        res.status(500).json({ success: false, message: 'Server error deleting audience group' });
    }
};

// Update audience group
const updateAudienceGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const isAdmin = req.user.role === 2;
        const tenantId = (isAdmin && (req.body.tenantId || req.query.tenantId)) ? (req.body.tenantId || req.query.tenantId) : (req.tenant?.id || req.user?.tenantId);
        const { name, description, isDynamic, filters, leadIds, propertyId, listingId } = req.body;

        const group = await prisma.audienceGroup.update({
            where: {
                id,
                tenantId
            },
            data: {
                ...(name && { name }),
                ...(description !== undefined && { description }),
                ...(isDynamic !== undefined && { isDynamic: !!isDynamic }),
                filters: (filters || propertyId || listingId) ? {
                    ...(filters || {}),
                    propertyId: propertyId || listingId
                } : undefined,
                leads: leadIds ? {
                    set: await prisma.lead.findMany({
                        where: { id: { in: leadIds }, tenantId },
                        select: { id: true }
                    })
                } : undefined
            },
            include: {
                _count: {
                    select: { leads: true }
                }
            }
        });

        res.status(200).json({ success: true, message: 'Audience group updated successfully', data: group });
    } catch (error) {
        console.error('Update audience group error:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ success: false, message: 'Audience group not found or unauthorized' });
        }
        res.status(500).json({ success: false, message: 'Server error updating audience group' });
    }
};

module.exports = {
    getAllAudienceGroups,
    getAudienceGroupById,
    createAudienceGroup,
    updateAudienceGroup,
    deleteAudienceGroup
};
