const { prisma } = require('../config/database');

const moduleController = {
    // Admin: Get all system modules
    getAllModules: async (req, res) => {
        try {
            const modules = await prisma.module.findMany({
                orderBy: { name: 'asc' }
            });
            res.json({ success: true, data: modules });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Error fetching system modules.' });
        }
    },

    // Admin: Create a new module definition
    createModule: async (req, res) => {
        try {
            const { name, slug, description } = req.body;
            const module = await prisma.module.create({
                data: { name, slug, description }
            });
            res.status(201).json({ success: true, data: module });
        } catch (error) {
            if (error.code === 'P2002') {
                return res.status(400).json({ success: false, message: 'Module slug already exists.' });
            }
            res.status(500).json({ success: false, message: 'Error creating module.' });
        }
    },

    // Admin: Get modules for a specific tenant
    getTenantModules: async (req, res) => {
        try {
            const { tenantId } = req.params;

            const assignments = await prisma.tenantModule.findMany({
                where: { tenantId },
                include: { module: true }
            });

            res.json({ success: true, data: assignments });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Error fetching tenant modules.' });
        }
    },

    // Admin: Toggle module for a tenant
    toggleTenantModule: async (req, res) => {
        try {
            const { tenantId, moduleId } = req.body;
            const { isActive } = req.body;

            const assignment = await prisma.tenantModule.upsert({
                where: {
                    tenantId_moduleId: { tenantId, moduleId }
                },
                update: { isActive },
                create: { tenantId, moduleId, isActive }
            });

            res.json({ success: true, data: assignment });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Error updating tenant module entitlement.' });
        }
    },

    // User/Owner: Get my active modules
    getMyModules: async (req, res) => {
        try {
            const { tenantId } = req.user;

            const activeModules = await prisma.tenantModule.findMany({
                where: { tenantId, isActive: true },
                include: {
                    module: {
                        select: { slug: true, name: true }
                    }
                }
            });

            res.json({
                success: true,
                data: activeModules.map(am => am.module.slug)
            });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Error fetching active modules.' });
        }
    }
};

module.exports = moduleController;
