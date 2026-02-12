const { prisma } = require('../config/database');
const crypto = require('crypto');

// Generate batch of license keys (Admin only)
const generateKeys = async (req, res) => {
    try {
        const { planId, count = 1 } = req.body;

        if (!planId) {
            return res.status(400).json({ success: false, message: 'Plan ID is required' });
        }

        const keys = [];
        for (let i = 0; i < count; i++) {
            // Format: PLAN-XXXX-XXXX-XXXX
            const randomPart = crypto.randomBytes(6).toString('hex').toUpperCase();
            const key = `KEY-${randomPart.slice(0, 4)}-${randomPart.slice(4, 8)}-${randomPart.slice(8, 12)}`;
            keys.push({
                key,
                planId,
                status: 1 // Unused
            });
        }

        await prisma.licenseKey.createMany({
            data: keys
        });

        res.status(201).json({
            success: true,
            message: `${count} license keys generated successfully`,
            data: { keys }
        });
    } catch (error) {
        console.error('Generate keys error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error generating keys'
        });
    }
};

// Get all keys (Admin only)
const getAllKeys = async (req, res) => {
    try {
        const { status, planId } = req.query;

        const keys = await prisma.licenseKey.findMany({
            where: {
                ...(status && { status: parseInt(status) }),
                ...(planId && { planId })
            },
            include: {
                plan: { select: { name: true } },
                tenant: { select: { name: true, domain: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({
            success: true,
            data: { keys }
        });
    } catch (error) {
        console.error('Get keys error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching keys'
        });
    }
};

// Validate a key (Public/Owner register)
const validateKey = async (req, res) => {
    try {
        const { key, planId } = req.body;

        const licenseKey = await prisma.licenseKey.findUnique({
            where: { key },
            include: { plan: true }
        });

        if (!licenseKey) {
            return res.status(404).json({ success: false, message: 'License key not found' });
        }

        if (licenseKey.status !== 1) {
            return res.status(400).json({ success: false, message: 'License key has already been used or is invalid' });
        }

        if (planId && licenseKey.planId !== planId) {
            return res.status(400).json({ success: false, message: 'This key is not valid for the selected plan' });
        }

        res.status(200).json({
            success: true,
            message: 'License key is valid',
            data: {
                plan: licenseKey.plan
            }
        });
    } catch (error) {
        console.error('Validate key error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error validating key'
        });
    }
};

const activateKey = async (req, res) => {
    try {
        const { key } = req.body;
        const { tenantId, id: userId } = req.user;

        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'User must belong to a tenant to activate a license key' });
        }

        const licenseKey = await prisma.licenseKey.findUnique({
            where: { key },
            include: {
                plan: {
                    include: { modules: true }
                }
            }
        });

        if (!licenseKey) {
            return res.status(404).json({ success: false, message: 'License key not found' });
        }

        if (licenseKey.status !== 1) {
            return res.status(400).json({ success: false, message: 'License key has already been used or is invalid' });
        }

        // Transaction to update license key, tenant, and modules
        await prisma.$transaction(async (tx) => {
            // 0. Disassociate any previous license keys from this tenant (enforce 1:1)
            await tx.licenseKey.updateMany({
                where: { tenantId },
                data: { tenantId: null }
            });

            // 1. Mark current key as used
            await tx.licenseKey.update({
                where: { id: licenseKey.id },
                data: {
                    status: 2,
                    tenantId,
                    userId,
                    activatedAt: new Date()
                }
            });

            // 2. Update Tenant Plan
            await tx.tenant.update({
                where: { id: tenantId },
                data: {
                    planId: licenseKey.planId,
                    subscriptionStatus: 1, // Active
                    subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year default
                }
            });

            // 3. Assign Modules
            if (licenseKey.plan && licenseKey.plan.modules) {
                const planModuleIds = licenseKey.plan.modules.map(mod => mod.id);

                // Deactivate modules not in the new plan
                await tx.tenantModule.updateMany({
                    where: {
                        tenantId,
                        moduleId: { not: { in: planModuleIds } }
                    },
                    data: { isActive: false }
                });

                for (const mod of licenseKey.plan.modules) {
                    await tx.tenantModule.upsert({
                        where: {
                            tenantId_moduleId: {
                                tenantId,
                                moduleId: mod.id
                            }
                        },
                        update: { isActive: true },
                        create: {
                            tenantId,
                            moduleId: mod.id,
                            isActive: true
                        }
                    });
                }
            }
        });

        res.status(200).json({
            success: true,
            message: 'License key activated successfully. Your subscription has been updated.',
            data: {
                planName: licenseKey.plan.name
            }
        });
    } catch (error) {
        console.error('Activate key error detailed:', error);
        res.status(500).json({
            success: false,
            message: 'Server error activating key',
            error: error.message
        });
    }
};

module.exports = {
    generateKeys,
    getAllKeys,
    validateKey,
    activateKey
};
