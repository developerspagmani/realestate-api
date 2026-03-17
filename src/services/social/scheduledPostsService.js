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
            if (pages.length === 0) throw new Error('No Facebook pages found');

            const page = pages[0];
            const pageAccessToken = page.access_token;

            // Define a more resilient fetch strategy
            const fetchField = async (fields) => {
                try {
                    const res = await axios.get(`https://graph.facebook.com/v18.0/${platformPostId}`, {
                        params: { fields, access_token: pageAccessToken }
                    });
                    return res.data;
                } catch (e) {
                    const errMsg = e.response?.data?.error?.message || e.message;
                    console.warn(`📊 FB field fetch failed (${fields}) for ${platformPostId}: ${errMsg}`);
                    return null;
                }
            };

            // Try to get insights first
            const insightsRes = await fetchField('insights.metric(post_impressions_unique,post_engaged_users,post_reactions_by_type_total,post_comments_count,post_shares_count)');

            // Get simple metrics and shares separately
            const basicsRes = await fetchField('likes.summary(true),comments.summary(true)');
            const sharesRes = await fetchField('shares');

            const likes = basicsRes?.likes?.summary?.total_count || 0;
            const comments = basicsRes?.comments?.summary?.total_count || 0;
            const shares = sharesRes?.shares?.count || 0;

            // Try to get reach from insights
            let reach = 0;
            if (insightsRes?.insights) {
                const reachData = insightsRes.insights.data.find(i => i.name === 'post_impressions_unique');
                reach = reachData?.values[0]?.value || 0;
            }

            return {
                likes,
                comments,
                shares,
                reach
            };
        } catch (error) {
            console.error('Error fetching Facebook metrics:', error.response?.data || error.message);
            throw new Error('Failed to fetch Facebook metrics', { cause: error });
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
                ...pages.map(p => ({ token: p.access_token, name: p.name, id: p.id })),
                { token: account.accessToken, name: 'Main Account Token', id: 'user' }
            ];

            let workingToken = null;
            let commentToken = null;

            console.log(`🔍 Searching for a working token to access post ${platformPostId}...`);
            for (const t of tokens) {
                try {
                    const check = await axios.get(`https://graph.facebook.com/v18.0/${platformPostId}`, {
                        params: { fields: 'id', access_token: t.token }
                    });
                    if (check.data.id) {
                        workingToken = t.token;
                        console.log(`✅ Found working token: ${t.name}`);

                        try {
                            const commCheck = await axios.get(`https://graph.facebook.com/v18.0/${platformPostId}/comments`, {
                                params: { fields: 'id,from', limit: 1, access_token: t.token }
                            });
                            if (commCheck.data) {
                                commentToken = t.token;
                                console.log(`💎 Token ${t.name} has COMMENT & FROM permissions.`);
                            }
                        } catch (e) { /* quiet fallback */ }

                        if (!commentToken) commentToken = t.token;
                        break;
                    }
                } catch (e) { /* continue */ }
            }

            if (!workingToken && !platformPostId.includes('_') && pages.length > 0) {
                for (const p of pages) {
                    const prefixedId = `${p.id}_${platformPostId}`;
                    try {
                        const check = await axios.get(`https://graph.facebook.com/v18.0/${prefixedId}`, {
                            params: { fields: 'id', access_token: p.access_token }
                        });
                        if (check.data.id) {
                            platformPostId = prefixedId;
                            workingToken = p.access_token;
                            commentToken = p.access_token;
                            break;
                        }
                    } catch (e) { /* continue */ }
                }
            }

            if (!workingToken) {
                return { summary: { likes: 0, comments: 0, shares: 0, reach: 0 }, comments: [] };
            }

            const fetchSafe = async (fields, overrideToken = null) => {
                try {
                    const response = await axios.get(`https://graph.facebook.com/v18.0/${platformPostId}`, {
                        params: { fields, access_token: overrideToken || workingToken }
                    });
                    return response.data;
                } catch (e) {
                    return null;
                }
            };

            const likesRes = await fetchSafe('likes.summary(true).limit(0)');
            const commentsSummaryRes = await fetchSafe('comments.summary(true).limit(0)');
            const sharesRes = await fetchSafe('shares');
            const engagementRes = await fetchSafe('engagement');

            // Step 4: Fetch comments separately using the best available 'commentToken'
            let comments = [];
            const commentFields = 'id,message,created_time,from{id,name,picture{url}}';
            const basicCommentFields = 'id,message,created_time,from{id,name}';
            const safeCommentFields = 'id,message,created_time';

            const tryFetchComments = async () => {
                const token = commentToken || workingToken;
                // Try 1: Direct Edge with all details
                try {
                    console.log('🔄 Trying direct /comments edge with full details...');
                    const res = await axios.get(`https://graph.facebook.com/v18.0/${platformPostId}/comments`, {
                        params: { fields: commentFields, limit: 100, access_token: token }
                    });
                    if (res.data?.data) return res.data;
                } catch (e) { /* next */ }

                // Try 2: Direct Edge with just name/id
                try {
                    const res = await axios.get(`https://graph.facebook.com/v18.0/${platformPostId}/comments`, {
                        params: { fields: basicCommentFields, limit: 100, access_token: token }
                    });
                    if (res.data?.data) return res.data;
                } catch (e) { /* next */ }

                // Try 3: Direct Edge with no user info
                try {
                    const res = await axios.get(`https://graph.facebook.com/v18.0/${platformPostId}/comments`, {
                        params: { fields: safeCommentFields, limit: 100, access_token: token }
                    });
                    if (res.data?.data) return res.data;
                } catch (e) { /* next */ }

                // Try 4: Fallback to Post Node traversal (our previous method)
                console.log('🔄 All direct edges failed. Falling back to post node field traversal...');
                let fallback = await fetchSafe(`comments.limit(100){${commentFields}}`, token);
                if (!fallback) fallback = await fetchSafe(`comments.limit(100){${basicCommentFields}}`, token);
                if (!fallback) fallback = await fetchSafe(`comments.limit(100){${safeCommentFields}}`, token);
                if (!fallback) fallback = await fetchSafe('comments', token);

                return fallback;
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

            let reachCount = 0;
            const insights = await fetchSafe('insights.metric(post_impressions_unique)');
            if (insights?.insights?.data?.[0]?.values?.[0]?.value) {
                reachCount = insights.insights.data[0].values[0].value;
            }

            const likesCount = likesRes?.likes?.summary?.total_count || engagementRes?.engagement?.like_count || 0;
            const commentsCount = commentsSummaryRes?.comments?.summary?.total_count || engagementRes?.engagement?.comment_count || comments.length;
            const sharesCount = sharesRes?.shares?.count || engagementRes?.engagement?.share_count || 0;

            return {
                summary: { likes: likesCount, comments: commentsCount, shares: sharesCount, reach: reachCount },
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
            const insightData = await fetchIGField('insights.metric(impressions,reach,engagement)');

            const mainData = { ...basicData, ...insightData };

            if (!basicData) {
                return { summary: { likes: 0, comments: 0, shares: 0, reach: 0 }, comments: [] };
            }

            const likes = mainData.like_count || 0;
            const commentsCount = mainData.comments_count || 0;

            let reach = 0;
            if (mainData.insights) {
                const reachData = mainData.insights.data.find(i => i.name === 'reach');
                reach = reachData?.values[0]?.value || 0;
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
                summary: { likes, comments: commentsCount, shares: 0, reach },
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
