const { prisma } = require('../config/database');

// Get all audience groups
const getAllAudienceGroups = async (req, res) => {
    try {
        const tenantId = req.tenant?.id;
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

// Create audience group
const createAudienceGroup = async (req, res) => {
    try {
        const tenantId = req.tenant?.id;
        const { name, description, isDynamic, filters } = req.body;

        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'Tenant ID is required' });
        }

        const group = await prisma.audienceGroup.create({
            data: {
                name,
                description,
                isDynamic: !!isDynamic,
                filters: filters || {},
                tenantId
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
        const tenantId = req.tenant?.id;

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
        const tenantId = req.tenant?.id;
        const { name, description, isDynamic, filters } = req.body;

        const group = await prisma.audienceGroup.updateMany({
            where: { id, tenantId },
            data: {
                ...(name && { name }),
                ...(description !== undefined && { description }),
                ...(isDynamic !== undefined && { isDynamic: !!isDynamic }),
                ...(filters && { filters })
            }
        });

        res.status(200).json({ success: true, message: 'Audience group updated successfully', data: group });
    } catch (error) {
        console.error('Update audience group error:', error);
        res.status(500).json({ success: false, message: 'Server error updating audience group' });
    }
};

module.exports = {
    getAllAudienceGroups,
    createAudienceGroup,
    updateAudienceGroup,
    deleteAudienceGroup
};
