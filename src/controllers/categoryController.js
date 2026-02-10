const { prisma } = require('../config/database');

// Get all categories
const getAllCategories = async (req, res) => {
    try {
        const tenantId = req.user?.tenantId;

        const where = {
            status: 1,
            OR: [
                { tenantId: null }, // Global categories
                ...(tenantId ? [{ tenantId }] : [])
            ]
        };

        const categories = await prisma.propertyCategory.findMany({
            where,
            include: {
                parent: {
                    select: { id: true, name: true }
                },
                _count: {
                    select: { properties: true, children: true }
                }
            },
            orderBy: [
                { sortOrder: 'asc' },
                { name: 'asc' }
            ]
        });

        res.status(200).json({
            success: true,
            data: { categories }
        });
    } catch (error) {
        console.error('Get all categories error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching categories'
        });
    }
};

// Get category by ID
const getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await prisma.propertyCategory.findUnique({
            where: { id },
            include: {
                parent: true,
                children: true,
                properties: {
                    take: 10,
                    include: {
                        mainImage: true
                    }
                },
                _count: {
                    select: { properties: true }
                }
            }
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        res.status(200).json({
            success: true,
            data: { category }
        });
    } catch (error) {
        console.error('Get category by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching category'
        });
    }
};

// Create a new category
const createCategory = async (req, res) => {
    try {
        const { name, description, icon, parentId, sortOrder } = req.body;
        const tenantId = req.user?.tenantId;

        if (!tenantId) {
            return res.status(400).json({
                success: false,
                message: 'Tenant ID is required to create a category'
            });
        }

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Category name is required'
            });
        }

        // Generate slug from name
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        const category = await prisma.propertyCategory.create({
            data: {
                name,
                slug,
                description,
                icon: icon || 'bi-folder',
                parentId: parentId || null,
                sortOrder: sortOrder || 0,
                tenantId,
                status: 1
            }
        });

        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            data: { category }
        });
    } catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating category'
        });
    }
};

// Update a category
const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, icon, parentId, sortOrder, status } = req.body;
        const tenantId = req.user?.tenantId;

        // Verify ownership
        const existing = await prisma.propertyCategory.findUnique({
            where: { id }
        });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        // Only allow updating if it belongs to the tenant
        if (existing.tenantId && existing.tenantId !== tenantId) {
            return res.status(403).json({
                success: false,
                message: 'You can only update your own categories'
            });
        }

        // Prevent circular parent reference
        if (parentId === id) {
            return res.status(400).json({
                success: false,
                message: 'A category cannot be its own parent'
            });
        }

        // Generate slug if name is updated
        const slug = name ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : undefined;

        const category = await prisma.propertyCategory.update({
            where: { id },
            data: {
                name,
                slug,
                description,
                icon,
                parentId: parentId !== undefined ? (parentId || null) : undefined,
                sortOrder: sortOrder !== undefined ? parseInt(sortOrder) : undefined,
                status: status !== undefined ? parseInt(status) : undefined
            }
        });

        res.status(200).json({
            success: true,
            message: 'Category updated successfully',
            data: { category }
        });

    } catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating category'
        });
    }
};

// Delete a category
const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;

        // Verify ownership
        const existing = await prisma.propertyCategory.findUnique({
            where: { id },
            include: {
                _count: { select: { properties: true, children: true } }
            }
        });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        if (existing.tenantId !== tenantId) {
            return res.status(403).json({
                success: false,
                message: 'You can only delete your own categories'
            });
        }

        // Check if category has properties or children
        if (existing._count.properties > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete category with ${existing._count.properties} associated properties. Please reassign them first.`
            });
        }

        if (existing._count.children > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete category with ${existing._count.children} subcategories. Please delete or reassign them first.`
            });
        }

        // Hard delete since we have no dependencies
        await prisma.propertyCategory.delete({
            where: { id }
        });

        res.status(200).json({
            success: true,
            message: 'Category deleted successfully'
        });

    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error deleting category'
        });
    }
};

module.exports = {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory
};
