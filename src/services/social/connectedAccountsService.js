const { prisma } = require('../../config/database');
const axios = require('axios');

class ConnectedAccountsService {
    /**
     * Connect a social media account
     */
    async connectAccount(data) {
        const { tenantId, userId, platform, accessToken, refreshToken, accountId, accountName, metadata } = data;

        // Check if account already exists
        const existingAccount = await prisma.connectedAccount.findFirst({
            where: {
                userId,
                tenantId,
                platform
            }
        });

        const accountData = {
            tenantId,
            userId,
            platform,
            accountId,
            accountName,
            accessToken,
            refreshToken,
            metadata: metadata || {},
            isActive: true
        };

        let account;
        if (existingAccount) {
            // Update existing account
            account = await prisma.connectedAccount.update({
                where: { id: existingAccount.id },
                data: {
                    ...accountData,
                    updatedAt: new Date()
                }
            });
        } else {
            // Create new account
            account = await prisma.connectedAccount.create({
                data: accountData
            });
        }

        // If it's Facebook and we don't have pages in metadata, sync it now
        // This handles both OAuth redirect and SDK popup flows
        if ((platform === 'FACEBOOK' || platform === 'INSTAGRAM') && (!account.metadata || !account.metadata.pages || account.metadata.pages.length === 0)) {
            try {
                console.log(`🔄 Triggering initial sync for Facebook account: ${account.id}`);
                account = await this.syncAccountData(account.id, userId, tenantId);
            } catch (err) {
                console.error('Initial Facebook sync failed:', err.message);
                // We still return the account even if sync fails, but it won't have pages yet
            }
        }

        return account;
    }

    /**
     * Refresh account token
     */
    async refreshAccountToken(accountId, userId, tenantId) {
        const account = await prisma.connectedAccount.findFirst({
            where: { id: accountId, userId, tenantId }
        });

        if (!account) {
            throw new Error('Account not found');
        }

        if (!account.refreshToken) {
            throw new Error('No refresh token available');
        }

        // Platform-specific token refresh
        let newTokens;

        switch (account.platform) {
            case 'FACEBOOK':
            case 'INSTAGRAM':
                newTokens = await this.refreshMetaToken(account.refreshToken);
                break;
            case 'GOOGLE':
                newTokens = await this.refreshGoogleToken(account.refreshToken);
                break;
            default:
                throw new Error(`Token refresh not supported for ${account.platform}`);
        }

        // Update account with new tokens
        return await prisma.connectedAccount.update({
            where: { id: accountId },
            data: {
                accessToken: newTokens.accessToken,
                refreshToken: newTokens.refreshToken || account.refreshToken,
                tokenExpiry: newTokens.expiresAt ? new Date(newTokens.expiresAt) : null,
                updatedAt: new Date()
            }
        });
    }

    /**
     * Refresh Meta (Facebook/Instagram) token
     */
    async refreshMetaToken(refreshToken) {
        try {
            const response = await axios.post('https://graph.facebook.com/v18.0/oauth/access_token', null, {
                params: {
                    grant_type: 'fb_exchange_token',
                    client_id: process.env.META_APP_ID,
                    client_secret: process.env.META_APP_SECRET,
                    fb_exchange_token: refreshToken
                }
            });

            const { access_token, expires_in } = response.data;
            const expiresAt = expires_in
                ? new Date(Date.now() + expires_in * 1000)
                : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days default

            return {
                accessToken: access_token,
                expiresAt
            };
        } catch (error) {
            console.error('Meta token refresh error:', error.response?.data || error.message);
            throw new Error('Failed to refresh Meta token', { cause: error });
        }
    }

    /**
     * Refresh Google token
     */
    async refreshGoogleToken(refreshToken) {
        try {
            const response = await axios.post('https://oauth2.googleapis.com/token', {
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            });

            const { access_token, expires_in } = response.data;
            const expiresAt = expires_in
                ? new Date(Date.now() + expires_in * 1000)
                : null;

            return {
                accessToken: access_token,
                expiresAt
            };
        } catch (error) {
            console.error('Google token refresh error:', error.response?.data || error.message);
            throw new Error('Failed to refresh Google token', { cause: error });
        }
    }

    /**
     * Exchange Meta OAuth code for tokens
     */
    async exchangeMetaCode(code, userId, tenantId, redirectUri) {
        try {
            const finalRedirectUri = redirectUri || `${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'http://localhost:3000'}/auth/meta/callback`;
            // Exchange code for access token
            const tokenResponse = await axios.post('https://graph.facebook.com/v18.0/oauth/access_token', null, {
                params: {
                    client_id: process.env.META_APP_ID,
                    client_secret: process.env.META_APP_SECRET,
                    redirect_uri: finalRedirectUri,
                    code
                }
            });

            const { access_token, expires_in } = tokenResponse.data;

            // Get user info
            const userResponse = await axios.get('https://graph.facebook.com/v18.0/me', {
                params: {
                    fields: 'id,name,email',
                    access_token
                }
            });

            const userData = userResponse.data;

            // Get user's pages (for Facebook/Instagram posting)
            const pagesResponse = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
                params: {
                    fields: 'id,name,access_token,category,instagram_business_account',
                    access_token
                }
            });

            const pages = pagesResponse.data.data || [];
            console.log(`📄 Found ${pages.length} Facebook pages for user ${userId}`);

            // Calculate token expiry
            const tokenExpiry = expires_in
                ? new Date(Date.now() + expires_in * 1000)
                : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days default

            // Save Facebook connection
            const account = await this.connectAccount({
                tenantId,
                userId,
                platform: 'FACEBOOK',
                accessToken: access_token,
                accountId: userData.id,
                accountName: userData.name || 'Facebook Account',
                metadata: {
                    email: userData.email,
                    pages: pages,
                    profileData: userData
                }
            });

            // If there's an Instagram Business Account linked to any page, save it as well
            const pageWithIG = pages.find(p => p.instagram_business_account);
            if (pageWithIG) {
                console.log(`📸 Found Instagram Business Account: ${pageWithIG.instagram_business_account.id}`);
                await this.connectAccount({
                    tenantId,
                    userId,
                    platform: 'INSTAGRAM',
                    accessToken: access_token, // Instagram uses the same token (or page token)
                    accountId: pageWithIG.instagram_business_account.id,
                    accountName: pageWithIG.instagram_business_account.name || `${userData.name} (Instagram)`,
                    metadata: {
                        linkedFacebookPage: pageWithIG.name,
                        linkedFacebookPageId: pageWithIG.id,
                        pages: pages // Keep pages metadata for context
                    }
                });
            }

            // Update token expiry
            await prisma.connectedAccount.update({
                where: { id: account.id },
                data: { tokenExpiry }
            });

            return account;
        } catch (error) {
            console.error('Meta code exchange error:', error.response?.data || error.message);

            // Handle specific error: code already used
            if (error.response?.data?.error?.code === 100 && error.response?.data?.error?.error_subcode === 36009) {
                throw new Error('Authorization code has already been used', { cause: error });
            }

            throw new Error(error.response?.data?.error?.message || 'Failed to connect Meta account', { cause: error });
        }
    }

    /**
     * Exchange Google OAuth code for tokens
     */
    async exchangeGoogleCode(code, userId, tenantId, redirectUri) {
        try {
            const finalRedirectUri = redirectUri || `${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'http://localhost:3000'}/auth/google/callback`;
            // Exchange code for tokens
            const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: finalRedirectUri,
                code,
                grant_type: 'authorization_code'
            });

            const { access_token, refresh_token, expires_in } = tokenResponse.data;

            // Get user info
            const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    Authorization: `Bearer ${access_token}`
                }
            });

            const userData = userResponse.data;

            // Calculate token expiry
            const tokenExpiry = expires_in
                ? new Date(Date.now() + expires_in * 1000)
                : null;

            // Save Google connection
            const account = await this.connectAccount({
                tenantId,
                userId,
                platform: 'GOOGLE',
                accessToken: access_token,
                refreshToken: refresh_token,
                accountId: userData.id,
                accountName: userData.name || userData.email || 'Google Account',
                metadata: {
                    email: userData.email,
                    picture: userData.picture,
                    profileData: userData
                }
            });

            // Update token expiry
            await prisma.connectedAccount.update({
                where: { id: account.id },
                data: { tokenExpiry }
            });

            return account;
        } catch (error) {
            console.error('Google code exchange error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.error_description || 'Failed to connect Google account', { cause: error });
        }
    }

    /**
     * Sync account data (refresh pages, profile, etc.)
     */
    async syncAccountData(accountId, userId, tenantId) {
        const account = await prisma.connectedAccount.findFirst({
            where: { id: accountId, userId, tenantId }
        });

        if (!account) {
            throw new Error('Account not found');
        }

        if (account.platform === 'FACEBOOK' || account.platform === 'INSTAGRAM') {
            try {
                console.log(`🔄 Syncing Meta data for ${account.platform} account: ${accountId}`);
                // Refresh pages data
                const pagesResponse = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
                    params: {
                        fields: 'id,name,access_token,category,instagram_business_account',
                        access_token: account.accessToken
                    }
                });

                const pages = pagesResponse.data.data || [];

                // Update metadata with fresh pages
                const updatedMetadata = {
                    ...account.metadata,
                    pages,
                    lastSynced: new Date().toISOString()
                };

                const updatedAccount = await prisma.connectedAccount.update({
                    where: { id: accountId },
                    data: {
                        metadata: updatedMetadata,
                        updatedAt: new Date()
                    }
                });

                // CROSS-SYNC: If we're on FB and find an IG, or vice-versa, ensure BOTH exist
                const pageWithIG = pages.find(p => p.instagram_business_account);
                
                if (pageWithIG && account.platform === 'FACEBOOK') {
                    // We found an IG account while syncing FB, make sure IG is connected too
                    console.log(`📸 Found linked Instagram during FB sync: ${pageWithIG.instagram_business_account.id}`);
                    await this.connectAccount({
                        tenantId,
                        userId,
                        platform: 'INSTAGRAM',
                        accessToken: account.accessToken,
                        accountId: pageWithIG.instagram_business_account.id,
                        accountName: pageWithIG.instagram_business_account.name || `${account.accountName} (Instagram)`,
                        metadata: {
                            linkedFacebookPage: pageWithIG.name,
                            linkedFacebookPageId: pageWithIG.id,
                            pages: pages,
                            syncedFrom: 'facebook_sync'
                        }
                    });
                }

                return updatedAccount;
            } catch (error) {
                console.error('Sync account data error:', error.response?.data || error.message);
                throw new Error('Failed to sync account data', { cause: error });
            }
        }

        return account;
    }
}

module.exports = ConnectedAccountsService;
