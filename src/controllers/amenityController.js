const { prisma } = require('../config/database');

// Get all amenities
const getAllAmenities = async (req, res) => {
    try {
        const { category } = req.query;
        // Access tenantId from authenticated user if available, or header if public/middleware handled
        // For admin/owners, we want to see global amenities (tenantId is null) AND their specific amenities

        const tenantId = req.user?.tenantId || req.tenantId;

        const where = {
            status: 1, // Active
            OR: [
                { tenantId: null }, // Global amenities
                ...(tenantId ? [{ tenantId }] : []) // Tenant specific amenities
            ]
        };

        if (category) {
            where.category = parseInt(category);
        }

        const amenities = await prisma.amenity.findMany({
            where,
            orderBy: { name: 'asc' }
        });

        res.status(200).json({
            success: true,
            data: { amenities }
        });
    } catch (error) {
        console.error('Get all amenities error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching amenities'
        });
    }
};

// Create a new amenity
const createAmenity = async (req, res) => {
    try {
        const { name, category, icon } = req.body;
        const tenantId = req.user?.tenantId;

        if (!tenantId) {
            return res.status(400).json({
                success: false,
                message: 'Tenant ID is required to create an amenity'
            });
        }

        const amenity = await prisma.amenity.create({
            data: {
                name,
                category: parseInt(category) || 1, // Default to facilities
                icon: icon || 'bi-check-circle',
                tenantId,
                status: 1
            }
        });

        res.status(201).json({
            success: true,
            message: 'Amenity created successfully',
            data: { amenity }
        });
    } catch (error) {
        console.error('Create amenity error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating amenity'
        });
    }
};

// Update an amenity
const updateAmenity = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category, icon, status } = req.body;
        const tenantId = req.user?.tenantId;

        // Verify ownership
        const existing = await prisma.amenity.findUnique({
            where: { id }
        });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Amenity not found'
            });
        }

        // Only allow updating if it belongs to the tenant
        if (existing.tenantId !== tenantId) {
            return res.status(403).json({
                success: false,
                message: 'You can only update your own amenities'
            });
        }

        const amenity = await prisma.amenity.update({
            where: { id },
            data: {
                name,
                category: category ? parseInt(category) : undefined,
                icon,
                status: status ? parseInt(status) : undefined
            }
        });

        res.status(200).json({
            success: true,
            message: 'Amenity updated successfully',
            data: { amenity }
        });

    } catch (error) {
        console.error('Update amenity error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating amenity'
        });
    }
};

// Delete an amenity
const deleteAmenity = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;

        // Verify ownership
        const existing = await prisma.amenity.findUnique({
            where: { id }
        });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Amenity not found'
            });
        }

        if (existing.tenantId !== tenantId) {
            return res.status(403).json({
                success: false,
                message: 'You can only delete your own amenities'
            });
        }

        // Soft delete
        await prisma.amenity.update({
            where: { id },
            data: { status: 2 } // Inactive
        });

        // Or hard delete if preferred, but soft delete is safer usually.
        // For now, let's just Soft Delete as status=2.

        res.status(200).json({
            success: true,
            message: 'Amenity deleted successfully'
        });

    } catch (error) {
        console.error('Delete amenity error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error deleting amenity'
        });
    }
};

module.exports = {
    getAllAmenities,
    createAmenity,
    updateAmenity,
    deleteAmenity
};
