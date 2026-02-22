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
        const { status, planId, tenantId } = req.query;

        const keys = await prisma.licenseKey.findMany({
            where: {
                ...(status && { status: parseInt(status) }),
                ...(planId && { planId }),
                ...(tenantId && { tenantId })
            },
            include: {
                plan: { select: { name: true, slug: true } },
                tenant: {
                    select: {
                        id: true,
                        name: true,
                        domain: true,
                        subscriptionExpiresAt: true,
                        subscriptionStatus: true
                    }
                }
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

/**
 * Shared helper: assign a license key to a tenant inside a transaction.
 * Called by both activateKey (owner self-service) and adminAssignKey (admin override).
 */
const assignKeyToTenant = async (tx, licenseKey, tenantId, expiresAt) => {
    // 0. Disassociate any previous license keys from this tenant
    await tx.licenseKey.updateMany({
        where: { tenantId },
        data: { tenantId: null }
    });

    // 1. Mark current key as used and bind to tenant
    await tx.licenseKey.update({
        where: { id: licenseKey.id },
        data: {
            status: 2,
            tenantId,
            activatedAt: new Date()
        }
    });

    // 2. Update Tenant subscription info
    const expiry = expiresAt
        ? new Date(expiresAt)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year default

    await tx.tenant.update({
        where: { id: tenantId },
        data: {
            planId: licenseKey.planId,
            subscriptionStatus: 1, // Active
            subscriptionExpiresAt: expiry
        }
    });

    // 3. Assign Plan Modules to tenant
    if (licenseKey.plan && licenseKey.plan.modules) {
        const planModuleIds = licenseKey.plan.modules.map(mod => mod.id);

        await tx.tenantModule.updateMany({
            where: { tenantId, moduleId: { not: { in: planModuleIds } } },
            data: { isActive: false }
        });

        for (const mod of licenseKey.plan.modules) {
            await tx.tenantModule.upsert({
                where: { tenantId_moduleId: { tenantId, moduleId: mod.id } },
                update: { isActive: true },
                create: { tenantId, moduleId: mod.id, isActive: true }
            });
        }
    }
};

// Admin: Assign a license key directly to a tenant (bypasses owner self-activation)
const adminAssignKey = async (req, res) => {
    try {
        const { tenantId, keyId, expiresAt } = req.body;

        if (!tenantId || !keyId) {
            return res.status(400).json({ success: false, message: 'tenantId and keyId are required' });
        }

        const licenseKey = await prisma.licenseKey.findUnique({
            where: { id: keyId },
            include: { plan: { include: { modules: true } } }
        });

        if (!licenseKey) {
            return res.status(404).json({ success: false, message: 'License key not found' });
        }

        if (licenseKey.status !== 1) {
            return res.status(400).json({ success: false, message: 'License key has already been used or is invalid' });
        }

        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            return res.status(404).json({ success: false, message: 'Tenant not found' });
        }

        await prisma.$transaction(tx => assignKeyToTenant(tx, licenseKey, tenantId, expiresAt));

        res.status(200).json({
            success: true,
            message: `License key assigned to tenant. Plan: ${licenseKey.plan.name}`,
            data: { planName: licenseKey.plan.name }
        });
    } catch (error) {
        console.error('Admin assign key error:', error);
        res.status(500).json({ success: false, message: 'Server error assigning key', error: error.message });
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

        // Reuse shared helper in a transaction
        await prisma.$transaction(async (tx) => {
            // Bind the activating userId in addition to standard assignment steps
            await assignKeyToTenant(tx, licenseKey, tenantId, null);
            // Stamp the activating user id (owner self-activation)
            await tx.licenseKey.update({
                where: { id: licenseKey.id },
                data: { userId }
            });
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
    activateKey,
    adminAssignKey
};
