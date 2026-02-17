const { prisma } = require('../config/database');

// Get all plans
const getAllPlans = async (req, res) => {
    try {
        const { includeInactive } = req.query;
        const plans = await prisma.plan.findMany({
            where: includeInactive ? {} : { status: 1 },
            include: { modules: true },
            orderBy: { price: 'asc' }
        });

        res.status(200).json({
            success: true,
            data: { plans }
        });
    } catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching plans'
        });
    }
};

// Create a new plan (Admin only)
const createPlan = async (req, res) => {
    try {
        const { name, slug, description, price, interval, features, status, moduleIds } = req.body;

        const plan = await prisma.plan.create({
            data: {
                name,
                slug,
                description,
                price,
                interval: interval || 'yearly',
                features: features || {},
                status: status || 1,
                modules: moduleIds && moduleIds.length > 0 ? {
                    connect: moduleIds.map(id => ({ id }))
                } : undefined
            },
            include: { modules: true }
        });

        res.status(201).json({
            success: true,
            message: 'Plan created successfully',
            data: { plan }
        });
    } catch (error) {
        console.error('Create plan error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating plan'
        });
    }
};

// Update a plan (Admin only)
const updatePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, interval, features, status, moduleIds } = req.body;

        const plan = await prisma.plan.update({
            where: { id },
            data: {
                name,
                description,
                price,
                interval,
                features,
                status,
                modules: moduleIds ? {
                    set: moduleIds.map(id => ({ id }))
                } : undefined
            },
            include: { modules: true }
        });

        // Sync Logic: If modules were updated, update all tenants assigned to this plan
        if (moduleIds) {
            // 1. Get all tenants who have used a license key for this plan
            const licenseKeys = await prisma.licenseKey.findMany({
                where: { planId: id, status: 2 }, // 2: Activated
                select: { tenantId: true }
            });

            const tenantIds = [...new Set(licenseKeys.map(k => k.tenantId).filter(Boolean))];

            if (tenantIds.length > 0) {
                // For each tenant, ensure they have exactly the modules of this plan
                for (const tenantId of tenantIds) {
                    // Remove old modules for this tenant that are NOT in the new plan
                    // (Actually, maybe just clear and re-add for simplicity if performance allows)
                    await prisma.tenantModule.deleteMany({
                        where: { tenantId }
                    });

                    // Add new modules
                    if (moduleIds.length > 0) {
                        await prisma.tenantModule.createMany({
                            data: moduleIds.map(mId => ({
                                tenantId,
                                moduleId: mId,
                                isActive: true
                            }))
                        });
                    }
                }
            }
        }

        res.status(200).json({
            success: true,
            message: 'Plan updated successfully',
            data: { plan }
        });
    } catch (error) {
        console.error('Update plan error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating plan'
        });
    }
};

const deletePlan = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if plan is in use
        const inUse = await prisma.licenseKey.count({ where: { planId: id } });
        if (inUse > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete plan: It has assigned license keys'
            });
        }

        await prisma.plan.delete({ where: { id } });

        res.status(200).json({
            success: true,
            message: 'Plan deleted successfully'
        });
    } catch (error) {
        console.error('Delete plan error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error deleting plan'
        });
    }
};

module.exports = {
    getAllPlans,
    createPlan,
    updatePlan,
    deletePlan
};
