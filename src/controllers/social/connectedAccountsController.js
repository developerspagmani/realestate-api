const { prisma } = require('../../config/database');
const ConnectedAccountsService = require('../../services/social/connectedAccountsService');

const connectedAccountsService = new ConnectedAccountsService();

/**
 * Connect a social media account
 * @route POST /api/social/accounts/connect
 */
const connectAccount = async (req, res) => {
    try {
        const { platform, accessToken, refreshToken, accountId, accountName, metadata } = req.body;
        const userId = req.user.id;
        let tenantId = req.tenant?.id || req.user?.tenantId;
        
        // Super Admin fallback: If no tenantId, Super Admin should use the target tenant from query or default to their own
        if (!tenantId && req.user?.role === 2) {
            tenantId = req.query.tenantId || req.user?.tenantId;
        }

        // Validate required fields
        if (!platform || !accessToken || !accountId || !accountName) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: platform, accessToken, accountId, accountName'
            });
        }

        console.log(`📥 Connecting ${platform} account for user: ${userId}`);

        const account = await connectedAccountsService.connectAccount({
            tenantId,
            userId,
            platform: platform.toUpperCase(),
            accessToken,
            refreshToken,
            accountId,
            accountName,
            metadata: metadata || {}
        });

        console.log('✅ Account connected successfully');

        res.status(201).json({
            success: true,
            message: 'Account connected successfully',
            data: { account }
        });
    } catch (error) {
        console.error('Connect account error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error connecting account'
        });
    }
};

/**
 * Get all connected accounts for the current user
 * @route GET /api/social/accounts
 */
const getConnectedAccounts = async (req, res) => {
    try {
        const userId = req.user.id;
        let tenantId = req.tenant?.id || req.user?.tenantId;
        
        // Super Admin fallback
        if (!tenantId && req.user.role === 2) {
            tenantId = req.query.tenantId;
        }
        const { platform, isActive } = req.query;

        let where = { userId, tenantId };
        
        // Admin sees all connected accounts in the system
        if (req.user.role === 2) {
            where = {}; // Remove filters for super admin
        }

        if (platform) {
            where.platform = platform.toUpperCase();
        }

        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        }

        const accounts = await prisma.connectedAccount.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({
            success: true,
            data: { accounts }
        });
    } catch (error) {
        console.error('Get connected accounts error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching connected accounts'
        });
    }
};

/**
 * Get a specific connected account by ID
 * @route GET /api/social/accounts/:id
 */
const getConnectedAccountById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        const account = await prisma.connectedAccount.findFirst({
            where: { id, userId, tenantId }
        });

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Connected account not found'
            });
        }

        res.status(200).json({
            success: true,
            data: { account }
        });
    } catch (error) {
        console.error('Get connected account error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching connected account'
        });
    }
};

/**
 * Disconnect a social media account
 * @route DELETE /api/social/accounts/:id
 */
const disconnectAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        // Check if account exists and belongs to user
        const account = await prisma.connectedAccount.findFirst({
            where: { id, userId, tenantId }
        });

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Connected account not found'
            });
        }

        await prisma.connectedAccount.delete({
            where: { id }
        });

        res.status(200).json({
            success: true,
            message: 'Account disconnected successfully'
        });
    } catch (error) {
        console.error('Disconnect account error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error disconnecting account'
        });
    }
};

/**
 * Update account tokens (for token refresh)
 * @route PUT /api/social/accounts/:id/tokens
 */
const updateAccountTokens = async (req, res) => {
    try {
        const { id } = req.params;
        const { accessToken, refreshToken, tokenExpiry } = req.body;
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        if (!accessToken) {
            return res.status(400).json({
                success: false,
                message: 'Access token is required'
            });
        }

        // Check if account exists and belongs to user
        const account = await prisma.connectedAccount.findFirst({
            where: { id, userId, tenantId }
        });

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Connected account not found'
            });
        }

        const updatedAccount = await prisma.connectedAccount.update({
            where: { id },
            data: {
                accessToken,
                ...(refreshToken && { refreshToken }),
                ...(tokenExpiry && { tokenExpiry: new Date(tokenExpiry) }),
                updatedAt: new Date()
            }
        });

        res.status(200).json({
            success: true,
            message: 'Account tokens updated successfully',
            data: { account: updatedAccount }
        });
    } catch (error) {
        console.error('Update account tokens error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating account tokens'
        });
    }
};

/**
 * Refresh account token
 * @route POST /api/social/accounts/:id/refresh
 */
const refreshAccountToken = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        const account = await connectedAccountsService.refreshAccountToken(id, userId, tenantId);

        res.status(200).json({
            success: true,
            message: 'Account token refreshed successfully',
            data: { account }
        });
    } catch (error) {
        console.error('Refresh account token error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error refreshing account token'
        });
    }
};

/**
 * Get account by platform
 * @route GET /api/social/accounts/platform/:platform
 */
const getAccountByPlatform = async (req, res) => {
    try {
        const { platform } = req.params;
        const userId = req.user.id;
        let tenantId = req.tenant?.id || req.user?.tenantId;

        // Admin fallback to see Skyline accounts
        if (!tenantId && req.user.role === 2) {
            tenantId = '9fdf9466-624e-4790-b0ef-a0aa08ad09c0';
        }

        const account = await prisma.connectedAccount.findFirst({
            where: {
                userId,
                tenantId,
                platform: platform.toUpperCase(),
                isActive: true
            }
        });

        if (!account) {
            return res.status(404).json({
                success: false,
                message: `No active ${platform} account found`
            });
        }

        res.status(200).json({
            success: true,
            data: { account }
        });
    } catch (error) {
        console.error('Get account by platform error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching account'
        });
    }
};

/**
 * Get connection statistics
 * @route GET /api/social/accounts/stats
 */
const getConnectionStats = async (req, res) => {
    try {
        const userId = req.user.id;
        let tenantId = req.tenant?.id || req.user?.tenantId;

        // Admin fallback to see Skyline accounts
        if (!tenantId && req.user.role === 2) {
            tenantId = '9fdf9466-624e-4790-b0ef-a0aa08ad09c0';
        }

        let whereCount = { userId, tenantId };
        let whereGroup = { userId, tenantId, isActive: true };

        if (req.user.role === 2) {
            whereCount = {};
            whereGroup = { isActive: true };
        }

        const [total, active, byPlatform] = await Promise.all([
            prisma.connectedAccount.count({ where: whereCount }),
            prisma.connectedAccount.count({ where: { ...whereCount, isActive: true } }),
            prisma.connectedAccount.groupBy({
                by: ['platform'],
                where: whereGroup,
                _count: { id: true }
            })
        ]);

        const platformStats = byPlatform.reduce((acc, item) => {
            acc[item.platform] = item._count.id;
            return acc;
        }, {});

        res.status(200).json({
            success: true,
            data: {
                total,
                active,
                inactive: total - active,
                byPlatform: platformStats
            }
        });
    } catch (error) {
        console.error('Get connection stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching connection stats'
        });
    }
};

/**
 * Exchange Meta OAuth code for tokens
 * @route POST /api/social/accounts/meta/exchange
 */
const exchangeMetaCode = async (req, res) => {
    try {
        const { code, redirectUri } = req.body;
        console.log(`🔌 Exchange Meta Code initiated. Code length: ${code?.length || 0}`);
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Authorization code is required'
            });
        }

        const account = await connectedAccountsService.exchangeMetaCode(code, userId, tenantId, redirectUri);
        
        res.status(201).json({
            success: true,
            message: 'Meta account connected successfully',
            data: { account }
        });
    } catch (error) {
        console.error('Exchange Meta code error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error connecting Meta account'
        });
    }
};

/**
 * Handle Meta OAuth callback (GET) and redirect back to frontend
 * This is a 'Bridge' to allow localhost development with Meta
 * @route GET /api/social/accounts/meta/callback
 */
const handleMetaCallback = async (req, res) => {
    const { code, state, error, error_description } = req.query;
    
    // Default frontend callback URL or use the one provided in 'state'
    const FRONTEND_CALLBACK = state ? decodeURIComponent(state) : 'http://localhost:3000/realestate-owner-admin/auth/meta/callback';
    
    if (error) {
        return res.send(`
            <html>
                <body>
                    <script>
                        window.location.href = "${FRONTEND_CALLBACK}?error=${encodeURIComponent(error)}&message=${encodeURIComponent(error_description || '')}";
                    </script>
                </body>
            </html>
        `);
    }

    // Redirect to frontend with the code (Instant bridge via Meta Refresh to bypass CSP)
    res.send(`
        <html>
            <head>
                <title>Virpanix Bridge</title>
                <meta http-equiv="refresh" content="0; url=${FRONTEND_CALLBACK}?code=${code}">
                <style>body { background: #f9fafb; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; }</style>
            </head>
            <body>
                <div style="text-align: center;">
                    <p style="color: #6b7280; font-size: 14px;">Finalizing connection...</p>
                    <p style="color: #9ca3af; font-size: 12px;">If you are not redirected, <a href="${FRONTEND_CALLBACK}?code=${code}">click here</a></p>
                </div>
            </body>
        </html>
    `);
};

/**
 * Exchange Google OAuth code for tokens
 * @route POST /api/social/accounts/google/exchange
 */
const exchangeGoogleCode = async (req, res) => {
    try {
        const { code, redirectUri } = req.body;
        const userId = req.user.id;
        const tenantId = req.tenant?.id || req.user?.tenantId;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Authorization code is required'
            });
        }

        const account = await connectedAccountsService.exchangeGoogleCode(code, userId, tenantId, redirectUri);

        res.status(201).json({
            success: true,
            message: 'Google account connected successfully',
            data: { account }
        });
    } catch (error) {
        console.error('Exchange Google code error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error connecting Google account'
        });
    }
};

module.exports = {
    connectAccount,
    getConnectedAccounts,
    getConnectedAccountById,
    disconnectAccount,
    updateAccountTokens,
    refreshAccountToken,
    getAccountByPlatform,
    getConnectionStats,
    exchangeMetaCode,
    exchangeGoogleCode,
    handleMetaCallback
};
