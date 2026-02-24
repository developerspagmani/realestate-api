const { prisma } = require('../../config/database');
const portal99AcresService = require('../../services/social/Portal99AcresService');

/**
 * Portal Integration Controller
 * Manages external real estate portal listings and lead sync
 */
const portalIntegrationController = {
    /**
     * Get all portal listings for a tenant/property
     */
    getListings: async (req, res) => {
        try {
            const tenantId = req.tenant?.id || req.user?.tenantId;
            const { propertyId } = req.query;

            const where = { tenantId };
            if (propertyId) where.propertyId = propertyId;

            const listings = await prisma.portalListing.findMany({
                where,
                include: {
                    property: {
                        select: { title: true, slug: true }
                    }
                },
                orderBy: { updatedAt: 'desc' }
            });

            res.status(200).json({ success: true, data: listings });
        } catch (error) {
            console.error('Get portal listings error:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch portal listings' });
        }
    },

    /**
     * Publish a property to a specific portal
     */
    publish: async (req, res) => {
        try {
            const tenantId = req.tenant?.id || req.user?.tenantId;
            const { propertyId, portal } = req.body;

            if (!propertyId || !portal) {
                return res.status(400).json({ success: false, message: 'Property ID and Portal name are required' });
            }

            let result;
            if (portal.toUpperCase() === '99ACRES') {
                result = await portal99AcresService.publishListing(propertyId, tenantId);
            } else {
                return res.status(400).json({ success: false, message: `Portal ${portal} not supported yet` });
            }

            if (result.success) {
                res.status(200).json({ success: true, message: `Property published to ${portal} successfully`, data: result.portalListing });
            } else {
                res.status(500).json({ success: false, message: result.error });
            }
        } catch (error) {
            console.error('Publish portal listing error:', error);
            res.status(500).json({ success: false, message: 'Internal server error during publishing' });
        }
    },

    /**
     * Save portal credentials
     */
    updateCredentials: async (req, res) => {
        try {
            const tenantId = req.tenant?.id || req.user?.tenantId;
            const userId = req.user?.id;
            const { portal, username, password, apiKey } = req.body;

            if (!portal || !username) {
                return res.status(400).json({ success: false, message: 'Portal and Username are required' });
            }

            const platform = portal.toUpperCase() === '99ACRES' ? 'NINETYNINE_ACRES' : null;
            if (!platform) return res.status(400).json({ success: false, message: 'Unsupported portal' });

            const account = await prisma.connectedAccount.upsert({
                where: {
                    tenantId_platform_platformAccountId: {
                        tenantId,
                        platform,
                        platformAccountId: username
                    }
                },
                update: {
                    accessToken: password || apiKey || '',
                    updatedAt: new Date()
                },
                create: {
                    tenantId,
                    userId,
                    platform,
                    platformAccountId: username,
                    accountName: `${portal} Account (${username})`,
                    accessToken: password || apiKey || '',
                    isActive: true
                }
            });

            res.status(200).json({ success: true, message: 'Credentials saved successfully', data: account });
        } catch (error) {
            console.error('Update portal credentials error:', error);
            res.status(500).json({ success: false, message: 'Failed to save credentials' });
        }
    },

    /**
     * Manually trigger lead sync from a portal
     */
    syncLeads: async (req, res) => {
        try {
            const tenantId = req.tenant?.id || req.user?.tenantId;
            const { portal } = req.body;

            // In a real app, you'd fetch credentials from the tenant's settings/integrations table
            const credentials = { username: 'demo_user', password: 'demo_password' };

            let result;
            if (portal.toUpperCase() === '99ACRES') {
                result = await portal99AcresService.pollLeads(tenantId, credentials);
            } else {
                return res.status(400).json({ success: false, message: `Sync for ${portal} not supported yet` });
            }

            if (result.success) {
                res.status(200).json({ success: true, message: `Fetched ${result.processed} new leads from ${portal}` });
            } else {
                res.status(500).json({ success: false, message: result.error });
            }
        } catch (error) {
            console.error('Lead sync error:', error);
            res.status(500).json({ success: false, message: 'Failed to sync leads from portal' });
        }
    }
};

module.exports = portalIntegrationController;
