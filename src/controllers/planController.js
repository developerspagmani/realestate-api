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

module.exports = {
    getAllPlans,
    createPlan,
    updatePlan
};
