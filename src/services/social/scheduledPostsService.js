const { prisma } = require('../../config/database');
const axios = require('axios');

class ScheduledPostsService {
    /**
     * Publish a post immediately to all selected platforms
     */
    async publishNow(postId, userId, tenantId) {
        // Get the scheduled post
        const post = await prisma.scheduledPost.findFirst({
            where: { id: postId, userId, tenantId },
            include: {
                property: true,
                user: true
            }
        });

        if (!post) {
            throw new Error('Scheduled post not found');
        }

        // Get connected accounts for the platforms
        const connectedAccounts = await prisma.connectedAccount.findMany({
            where: {
                userId,
                tenantId,
                platform: { in: post.platforms },
                isActive: true
            }
        });

        if (connectedAccounts.length === 0) {
            throw new Error('No connected accounts found for the selected platforms');
        }

        const results = [];
        const publishedPosts = [];

        // Publish to each platform
        for (const account of connectedAccounts) {
            try {
                let publishResult;

                switch (account.platform) {
                    case 'FACEBOOK':
                        publishResult = await this.publishToFacebook(post, account);
                        break;
                    case 'INSTAGRAM':
                        publishResult = await this.publishToInstagram(post, account);
                        break;
                    case 'GOOGLE':
                        publishResult = await this.publishToGoogle(post, account);
                        break;
                    default:
                        throw new Error(`Publishing to ${account.platform} not implemented yet`);
                }

                // Create published post record
                const publishedPost = await prisma.publishedPost.create({
                    data: {
                        tenantId,
                        userId,
                        scheduledPostId: postId,
                        platform: account.platform,
                        platformPostId: publishResult.postId,
                        postUrl: publishResult.postUrl,
                        caption: post.description,
                        mediaUrls: post.mediaUrls,
                        hashtags: post.hashtags,
                        status: 'published',
                        metrics: publishResult.metrics || {}
                    }
                });

                publishedPosts.push(publishedPost);
                results.push({
                    platform: account.platform,
                    success: true,
                    postId: publishResult.postId,
                    postUrl: publishResult.postUrl
                });
            } catch (error) {
                console.error(`Error publishing to ${account.platform}:`, error);
                results.push({
                    platform: account.platform,
                    success: false,
                    error: error.message
                });
            }
        }

        // Update scheduled post status
        const allSuccessful = results.every(r => r.success);
        await prisma.scheduledPost.update({
            where: { id: postId },
            data: {
                status: allSuccessful ? 'POSTED' : 'FAILED',
                executionResults: results,
                lastPostedAt: new Date()
            }
        });

        return {
            success: allSuccessful,
            results,
            publishedPosts
        };
    }

    /**
     * Publish to Facebook
     */
    async publishToFacebook(post, account) {
        const metadata = account.metadata || {};
        let pages = metadata.pages || [];

        // RESILIENCE BOOSTER: If no pages found in metadata, try to sync now
        // This is a self-healing mechanism for accounts connected without full page data
        if (pages.length === 0) {
            console.log(`⚠️ No pages found in metadata for account ${account.id}. Attempting on-the-fly sync...`);
            try {
                const refreshedAccount = await this.syncAccountData(account.id, account.userId, account.tenantId);
                pages = refreshedAccount.metadata?.pages || [];
                console.log(`✅ On-the-fly sync successful. Found ${pages.length} pages.`);
            } catch (syncErr) {
                console.error(`❌ On-the-fly sync failed: ${syncErr.message}`);
                // We'll continue and throw the error below if pages is still empty
            }
        }

        if (pages.length === 0) {
            throw new Error('No Facebook pages found. Please ensure you have granted page management permissions and try reconnecting your Facebook account.');
        }

        // Use the first page
        const page = pages[0];
        const pageAccessToken = page.access_token;

        // Prepare the post data
        let message = `${post.title}\n\n${post.description || ''}`.trim();

        // BRAND BOOSTER: Add Goal-Specific CTA
        if (post.campaignGoal === 'LEAD_GENERATION') {
            message += `\n\n📩 Ready to see it? Message us for a private viewing!`;
        } else if (post.campaignGoal === 'SALES') {
            message += `\n\n💰 Special pricing available. Act now!`;
        }

        // AUDIENCE BOOSTER: Add Audience-specific hook
        if (post.targetAudience === 'FIRST_TIME') {
            message += `\n\n🔑 Perfect for first-time buyers! We help with all the paperwork.`;
        } else if (post.targetAudience === 'INVESTORS') {
            message += `\n\n📈 High ROI potential in a growing neighborhood.`;
        }

        // DYNAMIC CTA: Add WhatsApp Link if possible
        if (post.user && post.user.phone) {
            const cleanPhone = post.user.phone.replace(/[^0-9]/g, '');
            if (cleanPhone) {
                const waLink = `https://wa.me/${cleanPhone}?text=I%20am%20interested%20in%20${encodeURIComponent(post.title)}`;
                message += `\n\n📲 WhatsApp us: ${waLink}`;
            }
        }

        if (post.hashtags) {
            message += `\n\n${post.hashtags}`;
        }

        const postData = {
            message: message.trim(),
            access_token: pageAccessToken,
            published: true // Explicitly set to true to ensure it's not a dark post
        };

        // If it's a personal profile (not recommended but handled), add privacy
        // For Page posts, this will be ignored by Facebook but doesn't hurt
        postData.privacy = JSON.stringify({ value: 'EVERYONE' });

        // Add media if available
        if (post.mediaUrls && post.mediaUrls.length > 0) {
            if (post.isVideo) {
                // Video post
                const response = await axios.post(
                    `https://graph.facebook.com/v18.0/${page.id}/videos`,
                    {
                        ...postData,
                        file_url: post.mediaUrls[0]
                    }
                );
                return {
                    postId: response.data.id,
                    postUrl: `https://www.facebook.com/${response.data.id}`
                };
            } else if (post.mediaUrls.length === 1) {
                // Single image post
                const response = await axios.post(
                    `https://graph.facebook.com/v18.0/${page.id}/photos`,
                    {
                        ...postData,
                        url: post.mediaUrls[0]
                    }
                );
                return {
                    postId: response.data.id,
                    postUrl: `https://www.facebook.com/${response.data.id}`
                };
            } else {
                // Multiple images (carousel)
                // First upload all images
                const attachedMedia = [];
                for (const mediaUrl of post.mediaUrls) {
                    const uploadResponse = await axios.post(
                        `https://graph.facebook.com/v18.0/${page.id}/photos`,
                        {
                            url: mediaUrl,
                            published: false,
                            access_token: pageAccessToken
                        }
                    );
                    attachedMedia.push({ media_fbid: uploadResponse.data.id });
                }

                // Then create the post with all images
                const response = await axios.post(
                    `https://graph.facebook.com/v18.0/${page.id}/feed`,
                    {
                        message: postData.message,
                        attached_media: attachedMedia,
                        access_token: pageAccessToken,
                        published: true
                    }
                );

                return {
                    postId: response.data.id,
                    postUrl: `https://www.facebook.com/${response.data.id}`
                };
            }
        } else {
            // Text-only post
            const response = await axios.post(
                `https://graph.facebook.com/v18.0/${page.id}/feed`,
                postData
            );
            return {
                postId: response.data.id,
                postUrl: `https://www.facebook.com/${response.data.id}`
            };
        }
    }

    /**
     * Publish to Instagram
     */
    async publishToInstagram(post, account) {
        let metadata = account.metadata || {};
        let pages = metadata.pages || [];

        // Find a page with Instagram Business Account
        let pageWithIG = pages.find(p => p.instagram_business_account);

        // RESILIENCE BOOSTER: If no IG account found, try to sync now
        if (!pageWithIG) {
            console.log(`⚠️ No Instagram account found in metadata for account ${account.id}. Attempting on-the-fly sync...`);
            try {
                const refreshedAccount = await this.syncAccountData(account.id, account.userId, account.tenantId);
                pages = refreshedAccount.metadata?.pages || [];
                pageWithIG = pages.find(p => p.instagram_business_account);
                console.log(pageWithIG ? `✅ On-the-fly sync found Instagram account.` : `❌ Sync successful but no Instagram account linked.`);
            } catch (syncErr) {
                console.error(`❌ On-the-fly sync failed: ${syncErr.message}`);
            }
        }

        if (!pageWithIG) {
            throw new Error('No Instagram Business Account found. Ensure your Instagram account is linked to a Facebook Page and converted to a Professional/Business account.');
        }

        const igAccountId = pageWithIG.instagram_business_account.id;
        const pageAccessToken = pageWithIG.access_token;

        if (!post.mediaUrls || post.mediaUrls.length === 0) {
            throw new Error('Instagram posts require at least one image or video');
        }

        // Prepare the caption
        let caption = `${post.title}\n\n${post.description || ''}`.trim();

        // BRAND BOOSTER: Add Goal-Specific CTA
        if (post.campaignGoal === 'LEAD_GENERATION') {
            caption += `\n\n📩 Ready to see it? Message us for a private viewing!`;
        } else if (post.campaignGoal === 'SALES') {
            caption += `\n\n💰 Special pricing available. Act now!`;
        }

        // AUDIENCE BOOSTER: Add Audience-specific hook
        if (post.targetAudience === 'FIRST_TIME') {
            caption += `\n\n🔑 Perfect for first-time buyers! We help with all the paperwork.`;
        } else if (post.targetAudience === 'INVESTORS') {
            caption += `\n\n📈 High ROI potential in a growing neighborhood.`;
        }

        // DYNAMIC CTA: Add WhatsApp Link if possible
        if (post.user && post.user.phone) {
            const cleanPhone = post.user.phone.replace(/[^0-9]/g, '');
            if (cleanPhone) {
                const waLink = `https://wa.me/${cleanPhone}?text=I%20am%20interested%20in%20${encodeURIComponent(post.title)}`;
                caption += `\n\n📲 WhatsApp us: ${waLink}`;
            }
        }

        if (post.hashtags) {
            caption += `\n\n${post.hashtags}`;
        }

        caption = caption.trim();

        if (post.isVideo) {
            // Video post
            // Step 1: Create container
            const containerResponse = await axios.post(
                `https://graph.facebook.com/v18.0/${igAccountId}/media`,
                {
                    media_type: 'VIDEO',
                    video_url: post.mediaUrls[0],
                    caption,
                    access_token: pageAccessToken
                }
            );

            const creationId = containerResponse.data.id;

            // Step 2: Wait for video to be processed (simplified - in production, use polling)
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Step 3: Publish
            const publishResponse = await axios.post(
                `https://graph.facebook.com/v18.0/${igAccountId}/media_publish`,
                {
                    creation_id: creationId,
                    access_token: pageAccessToken
                }
            );

            return {
                postId: publishResponse.data.id,
                postUrl: `https://www.instagram.com/p/${publishResponse.data.id}`
            };
        } else if (post.mediaUrls.length === 1) {
            // Single image post
            const containerResponse = await axios.post(
                `https://graph.facebook.com/v18.0/${igAccountId}/media`,
                {
                    image_url: post.mediaUrls[0],
                    caption,
                    access_token: pageAccessToken
                }
            );

            const publishResponse = await axios.post(
                `https://graph.facebook.com/v18.0/${igAccountId}/media_publish`,
                {
                    creation_id: containerResponse.data.id,
                    access_token: pageAccessToken
                }
            );

            return {
                postId: publishResponse.data.id,
                postUrl: `https://www.instagram.com/p/${publishResponse.data.id}`
            };
        } else {
            // Carousel post
            const children = [];

            for (const mediaUrl of post.mediaUrls) {
                const childResponse = await axios.post(
                    `https://graph.facebook.com/v18.0/${igAccountId}/media`,
                    {
                        image_url: mediaUrl,
                        is_carousel_item: true,
                        access_token: pageAccessToken
                    }
                );
                children.push(childResponse.data.id);
            }

            const containerResponse = await axios.post(
                `https://graph.facebook.com/v18.0/${igAccountId}/media`,
                {
                    media_type: 'CAROUSEL',
                    children,
                    caption,
                    access_token: pageAccessToken
                }
            );

            const publishResponse = await axios.post(
                `https://graph.facebook.com/v18.0/${igAccountId}/media_publish`,
                {
                    creation_id: containerResponse.data.id,
                    access_token: pageAccessToken
                }
            );

            return {
                postId: publishResponse.data.id,
                postUrl: `https://www.instagram.com/p/${publishResponse.data.id}`
            };
        }
    }

    /**
     * Publish to Google My Business
     */
    async publishToGoogle(_post, _account) {
        // Google My Business posting implementation
        // This is a simplified version - full implementation would require location selection
        throw new Error('Google My Business posting not fully implemented yet');
    }

    /**
     * Get metrics for a Facebook post
     */
    async getFacebookMetrics(platformPostId, account) {
        try {
            const metadata = account.metadata || {};
            const pages = metadata.pages || [];
            
            // Re-use the same robust token discovery logic
            const tokens = [
                ...(process.env.FB_DEBUG_OVERRIDE_TOKEN ? [{ token: process.env.FB_DEBUG_OVERRIDE_TOKEN, name: 'Env Debug Token' }] : []),
                ...pages.map(p => ({ token: p.access_token, name: p.name })),
                { token: account.accessToken, name: 'Main Account Token' }
            ].filter(t => t.token);

            let workingToken = null;

            // Step 1: Find a working token
            for (const t of tokens) {
                try {
                    const check = await axios.get(`https://graph.facebook.com/v18.0/${platformPostId}`, {
                        params: { fields: 'id', access_token: t.token }
                    });
                    if (check.data.id) {
                        workingToken = t.token;
                        break;
                    }
                } catch (e) { /* continue */ }
            }

            // Step 2: Try Page-prefixed ID if needed
            if (!workingToken && !platformPostId.includes('_') && pages.length > 0) {
                for (const p of pages) {
                    const prefixedId = `${p.id}_${platformPostId}`;
                    const testToken = p.access_token || process.env.FB_DEBUG_OVERRIDE_TOKEN;
                    try {
                        const check = await axios.get(`https://graph.facebook.com/v18.0/${prefixedId}`, {
                            params: { fields: 'id', access_token: testToken }
                        });
                        if (check.data.id) {
                            platformPostId = prefixedId;
                            workingToken = testToken;
                            break;
                        }
                    } catch (e) { /* next page */ }
                }
            }

            if (!workingToken) {
                throw new Error(`Could not find working token for Facebook post ${platformPostId}`);
            }

            // Step 3: Fetch metrics with the working token
            const fetchField = async (fields) => {
                try {
                    const res = await axios.get(`https://graph.facebook.com/v18.0/${platformPostId}`, {
                        params: { fields, access_token: workingToken }
                    });
                    return res.data;
                } catch (e) {
                    return null;
                }
            };

            const [insightsRes, basicsRes, sharesRes] = await Promise.all([
                fetchField('insights.metric(post_impressions_unique)'),
                fetchField('likes.summary(true).limit(0),comments.summary(true).limit(0)'),
                fetchField('shares')
            ]);

            const likes = basicsRes?.likes?.summary?.total_count || 0;
            const comments = basicsRes?.comments?.summary?.total_count || 0;
            const shares = sharesRes?.shares?.count || 0;
            
            let reach = 0;
            if (insightsRes?.insights) {
                const reachData = insightsRes.insights.data.find(i => i.name === 'post_impressions_unique');
                reach = reachData?.values[0]?.value || 0;
            }

            return { likes, comments, shares, reach };
        } catch (error) {
            console.error('Error fetching Facebook metrics:', error.message);
            throw error;
        }
    }

    /**
     * Get detailed engagement for a Facebook post including comments and commenter details
     */
    async getFacebookDetailedEngagement(platformPostId, account) {
        try {
            const metadata = account.metadata || {};
            const pages = metadata.pages || [];
            
            const tokens = [
                ...(process.env.FB_DEBUG_OVERRIDE_TOKEN ? [{ token: process.env.FB_DEBUG_OVERRIDE_TOKEN, name: 'Env Debug Token', id: 'manual' }] : []),
                ...pages.map(p => ({ token: p.access_token, name: p.name, id: p.id })),
                { token: account.accessToken, name: 'Main Account Token', id: 'user' }
            ];

            let workingToken = null;
            let commentToken = null;

            // Step 1: Deep Token Validation
            console.log(`🔍 Validating tokens for engagement access on ${platformPostId}...`);
            console.log(`📡 Total tokens to test: ${tokens.length}. Pages in metadata: ${pages?.length || 0}`);
            
            for (const t of tokens) {
                try {
                    const check = await axios.get(`https://graph.facebook.com/v18.0/${platformPostId}`, {
                        params: { fields: 'id,likes.summary(true).limit(0)', access_token: t.token }
                    });
                    if (check.data.id) {
                        workingToken = t.token;
                        console.log(`✅ Proven Engagement Token: ${t.name}`);
                        
                        try {
                            const commCheck = await axios.get(`https://graph.facebook.com/v18.0/${platformPostId}/comments`, {
                                params: { fields: 'id,from', limit: 1, access_token: t.token }
                            });
                            if (commCheck.data) {
                                commentToken = t.token;
                                console.log(`💎 Premium Token: ${t.name} (Has Comment/From perms)`);
                            }
                        } catch (e) { /* silent */ }
                        
                        if (!commentToken) commentToken = t.token;
                        break;
                    }
                } catch (e) {
                    const fbErr = e.response?.data?.error?.message || e.message;
                    console.log(`❌ Token [${t.name}] rejected: ${fbErr}`);
                }
            }

            // Step 2: Page-prefixed ID format resolution (CRITICAL for Business Pages)
            if (!platformPostId.includes('_') && pages.length > 0) {
                console.log(`🔗 Checking for Page-scoped ID for ${platformPostId}...`);
                for (const p of pages) {
                    const prefixedId = `${p.id}_${platformPostId}`;
                    const testToken = p.access_token || process.env.FB_DEBUG_OVERRIDE_TOKEN;
                    try {
                        const check = await axios.get(`https://graph.facebook.com/v18.0/${prefixedId}`, {
                            params: { fields: 'id', access_token: testToken }
                        });
                        if (check.data.id) {
                            console.log(`✅ Found Page-prefixed ID: ${prefixedId}`);
                            platformPostId = prefixedId;
                            workingToken = testToken;
                            commentToken = testToken;
                            break;
                        }
                    } catch (e) {
                         console.log(`   └─ Failed with Page ${p.name}: ${e.response?.data?.error?.message || e.message}`);
                    }
                }
            }

            if (!workingToken) {
                console.error(`❌ Total failure: Could not find working token for ${platformPostId}`);
                return { summary: { likes: 0, comments: 0, shares: 0, reach: 0 }, comments: [] };
            }

            const fetchSafe = async (fields, overrideToken = null) => {
                const token = overrideToken || workingToken;
                try {
                    const response = await axios.get(`https://graph.facebook.com/v18.0/${platformPostId}`, {
                        params: { fields, access_token: token }
                    });
                    return response.data;
                } catch (e) {
                    const errMsg = e.response?.data?.error?.message || e.message;
                    console.warn(`📊 FB fetch failed [${fields}]: ${errMsg}`);
                    return null;
                }
            };

            const likesRes = await fetchSafe('likes.summary(true).limit(0)');
            const commentsSummaryRes = await fetchSafe('comments.summary(true).limit(0)');
            const sharesRes = await fetchSafe('shares');
            const engagementRes = await fetchSafe('engagement');
            
            // Step 4: Multi-Token & Multi-Field Comment Fetch Engine
            let comments = [];
            const commentFields = 'id,message,created_time,from{id,name,picture{url}}';
            const basicCommentFields = 'id,message,created_time,from{id,name}';
            const safeCommentFields = 'id,message,created_time';

            const tryFetchComments = async () => {
                const tokensToTry = [
                    { t: commentToken, n: 'Optimal Token' },
                    { t: account.accessToken, n: 'User Account Token' },
                    ...(process.env.FB_DEBUG_OVERRIDE_TOKEN ? [{ t: process.env.FB_DEBUG_OVERRIDE_TOKEN, n: 'Env Debug Token' }] : [])
                ].filter(x => x.t && x.t !== 'null' && x.t !== 'undefined');

                for (const meta of tokensToTry) {
                    console.log(`🔄 Attempting comment fetch for ${platformPostId} with ${meta.n}...`);
                    
                    // FALLBACK 1: Direct Edge
                    for (const f of [commentFields, basicCommentFields, safeCommentFields, 'id,message']) {
                        try {
                            const res = await axios.get(`https://graph.facebook.com/v18.0/${platformPostId}/comments`, {
                                params: { fields: f, limit: 100, access_token: meta.t }
                            });
                            if (res.data?.data && res.data.data.length > 0) {
                                console.log(`✅ Success via /comments edge using ${meta.n} (Fields: ${f})`);
                                return res.data;
                            }
                        } catch (e) { /* silent next */ }
                    }

                    // FALLBACK 2: Node Traversal
                    const traversal = await fetchSafe(`comments.limit(100){${commentFields}}`, meta.t);
                    if (traversal?.comments?.data && traversal.comments.data.length > 0) {
                        console.log(`✅ Success via node-traversal using ${meta.n}`);
                        return traversal;
                    }
                }
                return null;
            };

            const commentsData = await tryFetchComments();

            if (commentsData?.comments?.data || commentsData?.data) {
                const rawComments = commentsData.comments?.data || commentsData.data || [];
                console.log(`💬 Successfully retrieved ${rawComments.length} comments for ${platformPostId}`);
                comments = rawComments.map(c => ({
                    id: c.id,
                    message: c.message || '[Content Hidden/Restricted]',
                    createdAt: c.created_time || new Date().toISOString(),
                    user: c.from ? {
                        id: c.from.id,
                        name: c.from.name,
                        picture: c.from.picture?.data?.url
                    } : { name: 'Facebook User', id: 'unknown' }
                }));
            } else {
                console.log(`💬 All comment fetch attempts failed or returned empty for ${platformPostId}.`, commentsData);
            }

            // Step 5: Advanced Metrics Extraction
            console.log(`📊 Extracting premium metrics for ${platformPostId}...`);
            let reachCount = 0;
            let impressionsCount = 0;

            const insights = await fetchSafe('insights.metric(post_impressions_unique,post_impressions,post_reach)');
            if (insights?.insights?.data) {
                const reachNode = insights.insights.data.find(i => i.name === 'post_impressions_unique' || i.name === 'post_reach');
                const impressionsNode = insights.insights.data.find(i => i.name === 'post_impressions');
                reachCount = reachNode?.values?.[0]?.value || 0;
                impressionsCount = impressionsNode?.values?.[0]?.value || 0;
                console.log(`📈 Reach: ${reachCount}, Impressions: ${impressionsCount}`);
            }

            const likesCount = likesRes?.likes?.summary?.total_count || engagementRes?.engagement?.like_count || 0;
            const commentsCount = commentsSummaryRes?.comments?.summary?.total_count || engagementRes?.engagement?.comment_count || 0;
            const sharesCount = sharesRes?.shares?.count || engagementRes?.shares?.count || engagementRes?.engagement?.share_count || 0;
            
            console.log(`📊 Totals -> Likes: ${likesCount}, Comments: ${commentsCount}, Shares: ${sharesCount}`);

            return {
                summary: { 
                    likes: likesCount, 
                    comments: commentsCount, 
                    shares: sharesCount, 
                    reach: reachCount,
                    impressions: impressionsCount,
                    engagements: (likesCount + commentsCount + sharesCount)
                },
                comments
            };
        } catch (error) {
            console.error('Critical error in getFacebookDetailedEngagement:', error.message);
            return { summary: { likes: 0, comments: 0, shares: 0, reach: 0 }, comments: [] };
        }
    }

    async getInstagramDetailedEngagement(platformPostId, account) {
        try {
            const metadata = account.metadata || {};
            const pages = metadata.pages || [];
            const pageWithIG = pages.find(p => p.instagram_business_account);
            if (!pageWithIG) throw new Error('No Instagram Business Account found');

            const pageAccessToken = pageWithIG.access_token;

            const fetchIGField = async (fields) => {
                try {
                    const res = await axios.get(`https://graph.facebook.com/v18.0/${platformPostId}`, {
                        params: { fields, access_token: pageAccessToken }
                    });
                    return res.data;
                } catch (e) {
                    console.warn(`📸 IG field fetch failed (${fields}) for ${platformPostId}`);
                    return null;
                }
            };

            const basicData = await fetchIGField('like_count,comments_count,comments{id,text,created_time,from{id,username,profile_picture_url}}');
            const insightData = await fetchIGField('insights.metric(impressions,reach,engagement,video_views)');
            
            const mainData = { ...basicData, ...insightData };

            if (!basicData) {
                return { summary: { likes: 0, comments: 0, shares: 0, reach: 0 }, comments: [] };
            }

            const likes = mainData.like_count || 0;
            const commentsCount = mainData.comments_count || 0;

            let reach = 0;
            let impressions = 0;
            if (mainData.insights) {
                const reachNode = mainData.insights.data.find(i => i.name === 'reach');
                const impressionsNode = mainData.insights.data.find(i => i.name === 'impressions');
                reach = reachNode?.values?.[0]?.value || 0;
                impressions = impressionsNode?.values?.[0]?.value || 0;
            }

            const commentsData = mainData.comments?.data || [];
            const comments = commentsData.map(c => ({
                id: c.id,
                message: c.text,
                createdAt: c.created_time,
                user: {
                    id: c.from?.id,
                    name: c.from?.username,
                    picture: c.from?.profile_picture_url || null
                }
            }));

            return {
                summary: { 
                    likes, 
                    comments: commentsCount, 
                    shares: 0, 
                    reach, 
                    impressions, 
                    engagements: (likes + commentsCount) 
                },
                comments
            };
        } catch (error) {
            console.error('Error fetching Instagram detailed engagement:', error.message);
            throw new Error(`Instagram API Error: ${error.message}`);
        }
    }

    async getInstagramMetrics(platformPostId, account) {
        try {
            const metadata = account.metadata || {};
            const pages = metadata.pages || [];
            const pageWithIG = pages.find(p => p.instagram_business_account);
            if (!pageWithIG) throw new Error('No Instagram Business Account found');

            const pageAccessToken = pageWithIG.access_token;

            const fetchField = async (fields) => {
                try {
                    const res = await axios.get(`https://graph.facebook.com/v18.0/${platformPostId}`, {
                        params: { fields, access_token: pageAccessToken }
                    });
                    return res.data;
                } catch (e) {
                    return null;
                }
            };

            const basicData = await fetchField('like_count,comments_count');
            const insightData = await fetchField('insights.metric(impressions,reach,engagement)');

            const likes = basicData?.like_count || 0;
            const comments = basicData?.comments_count || 0;

            let reach = 0;
            let impressions = 0;
            if (insightData?.insights) {
                const reachData = insightData.insights.data.find(i => i.name === 'reach');
                const impressionsData = insightData.insights.data.find(i => i.name === 'impressions');
                reach = reachData?.values[0]?.value || 0;
                impressions = impressionsData?.values[0]?.value || 0;
            }

            return { likes, comments, shares: 0, reach, impressions };
        } catch (error) {
            console.error('Error fetching Instagram metrics:', error.message);
            throw new Error('Failed to fetch Instagram metrics', { cause: error });
        }
    }

    async publishScheduledPosts() {
        try {
            const now = new Date();
            const allScheduled = await prisma.scheduledPost.findMany({
                where: { status: 'SCHEDULED' }
            });

            if (allScheduled.length === 0) return { count: 0 };

            const duePosts = allScheduled.filter(post => {
                const schedDate = new Date(post.scheduledDate);
                const [hours, minutes] = post.scheduledTime.split(':').map(Number);
                schedDate.setHours(hours, minutes, 0, 0);
                return schedDate <= now;
            });

            if (duePosts.length === 0) return { count: 0 };

            console.log(`🚀 [Background Worker] Found ${duePosts.length} posts due for publishing`);

            const results = [];
            for (const post of duePosts) {
                try {
                    const result = await this.publishNow(post.id, post.userId, post.tenantId);
                    results.push({ postId: post.id, success: result.success });
                } catch (error) {
                    console.error(`❌ Background publish failed for post ${post.id}:`, error.message);
                    results.push({ postId: post.id, success: false, error: error.message });
                }
            }

            return { count: duePosts.length, results };
        } catch (error) {
            console.error('❌ Critical error in background worker:', error);
            throw error;
        }
    }
}

module.exports = ScheduledPostsService;
