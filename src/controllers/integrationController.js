const { prisma } = require('../config/database');
const crypto = require('crypto');

const integrationController = {
    // Get all integrations for a tenant
    getIntegrations: async (req, res) => {
        try {
            const tenantId = req.tenant?.id || req.user?.tenantId;
            if (!tenantId) {
                return res.status(403).json({ success: false, message: 'Tenant context missing.' });
            }

            const integrations = await prisma.integration.findMany({
                where: { tenantId },
                orderBy: { createdAt: 'desc' }
            });

            res.json({ success: true, data: integrations });
        } catch (error) {
            console.error('Error fetching integrations:', error);
            res.status(500).json({ success: false, message: 'Server error fetching integrations.' });
        }
    },

    // Create a new integration (The "Connect" endpoint called by Portal)
    connect: async (req, res) => {
        try {
            const { siteUrl, siteName, platform, environment, isSandbox } = req.body;
            const tenantId = req.tenant?.id || req.user?.tenantId;

            if (!tenantId) {
                return res.status(403).json({ success: false, message: 'Tenant context missing.' });
            }

            // Generate a unique API Key
            const apiKey = `vp_${crypto.randomBytes(24).toString('hex')}`;

            const integration = await prisma.integration.create({
                data: {
                    tenantId,
                    siteUrl,
                    siteName,
                    platform: platform || 'wordpress',
                    apiKey,
                    environment: environment || 'production',
                    isSandbox: isSandbox || false,
                    status: true
                }
            });

            res.status(201).json({
                success: true,
                message: 'Connection established successfully.',
                data: {
                    apiKey: integration.apiKey,
                    id: integration.id
                }
            });
        } catch (error) {
            console.error('Error connecting integration:', error);
            res.status(500).json({ success: false, message: 'Failed to establish connection.' });
        }
    },

    // Toggle integration status (Revoke/Enable)
    toggleStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const tenantId = req.tenant?.id || req.user?.tenantId;

            const integration = await prisma.integration.findFirst({
                where: { id, tenantId }
            });

            if (!integration) {
                return res.status(404).json({ success: false, message: 'Integration not found.' });
            }

            const updated = await prisma.integration.update({
                where: { id },
                data: { status: !integration.status }
            });

            res.json({ success: true, data: updated });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Failed to update integration.' });
        }
    },

    // Delete an integration
    deleteIntegration: async (req, res) => {
        try {
            const { id } = req.params;
            const tenantId = req.tenant?.id || req.user?.tenantId;

            await prisma.integration.deleteMany({
                where: { id, tenantId }
            });

            res.json({ success: true, message: 'Integration removed.' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Failed to delete integration.' });
        }
    },

    // Public: Verify an API Key and return tenant info + widgets
    verifyKey: async (req, res) => {
        try {
            const { apiKey } = req.body;
            const origin = req.headers.origin || req.headers.referer;

            const integration = await prisma.integration.findUnique({
                where: { apiKey },
                include: {
                    tenant: {
                        select: {
                            id: true,
                            name: true,
                            website: true,
                            status: true
                        }
                    }
                }
            });

            if (!integration || !integration.status) {
                return res.status(401).json({ success: false, message: 'Invalid or revoked API key.' });
            }

            // Environment Check
            if (integration.environment === 'production' && !integration.isSandbox) {
                // In production, we should ideally check the origin
                // But simplified for now: just log it
                console.log(`Production request from: ${origin}`);
            }

            // Fetch Widgets for this tenant to provide immediate list to WP
            const widgets = await prisma.widget.findMany({
                where: { tenantId: integration.tenantId },
                select: {
                    id: true,
                    uniqueId: true,
                    name: true,
                    type: true
                }
            });

            // Update last sync
            await prisma.integration.update({
                where: { id: integration.id },
                data: { lastSyncAt: new Date() }
            });

            res.json({
                success: true,
                data: {
                    tenantName: integration.tenant.name,
                    tenantId: integration.tenantId,
                    environment: integration.environment,
                    isSandbox: integration.isSandbox,
                    widgets: widgets
                }
            });
        } catch (error) {
            console.error('Verify key error:', error);
            res.status(500).json({ success: false, message: 'Verification failed.' });
        }
    }
};

module.exports = integrationController;
