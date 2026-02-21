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
        const pages = metadata.pages || [];

        if (pages.length === 0) {
            throw new Error('No Facebook pages found');
        }

        // Use the first page
        const page = pages[0];
        const pageAccessToken = page.access_token;

        // Prepare the post data
        const postData = {
            message: `${post.title}\n\n${post.description || ''}\n\n${post.hashtags || ''}`.trim(),
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
        const metadata = account.metadata || {};
        const pages = metadata.pages || [];

        // Find a page with Instagram Business Account
        const pageWithIG = pages.find(p => p.instagram_business_account);

        if (!pageWithIG) {
            throw new Error('No Instagram Business Account found');
        }

        const igAccountId = pageWithIG.instagram_business_account.id;
        const pageAccessToken = pageWithIG.access_token;

        if (!post.mediaUrls || post.mediaUrls.length === 0) {
            throw new Error('Instagram posts require at least one image or video');
        }

        const caption = `${post.title}\n\n${post.description || ''}\n\n${post.hashtags || ''}`.trim();

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
    async publishToGoogle(post, account) {
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

            const response = await axios.get(`https://graph.facebook.com/v18.0/${platformPostId}`, {
                params: {
                    fields: 'insights.metric(post_impressions_unique,post_engaged_users,post_reactions_by_type_total,post_comments_count,post_shares_count)',
                    access_token: pageAccessToken
                }
            });

            // If the above fails or returns nothing, try a simpler field set
            const simpleResponse = await axios.get(`https://graph.facebook.com/v18.0/${platformPostId}`, {
                params: {
                    fields: 'likes.summary(true),comments.summary(true),shares',
                    access_token: pageAccessToken
                }
            });

            const likes = simpleResponse.data.likes?.summary?.total_count || 0;
            const comments = simpleResponse.data.comments?.summary?.total_count || 0;
            const shares = simpleResponse.data.shares?.count || 0;

            // Try to get reach from insights if possible
            let reach = 0;
            if (response.data.insights) {
                const reachData = response.data.insights.data.find(i => i.name === 'post_impressions_unique');
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
            throw new Error('Failed to fetch Facebook metrics');
        }
    }

    /**
     * Get metrics for an Instagram post
     */
    async getInstagramMetrics(platformPostId, account) {
        try {
            const metadata = account.metadata || {};
            const pages = metadata.pages || [];
            const pageWithIG = pages.find(p => p.instagram_business_account);
            if (!pageWithIG) throw new Error('No Instagram Business Account found');

            const pageAccessToken = pageWithIG.access_token;

            const response = await axios.get(`https://graph.facebook.com/v18.0/${platformPostId}`, {
                params: {
                    fields: 'like_count,comments_count,insights.metric(impressions,reach,engagement)',
                    access_token: pageAccessToken
                }
            });

            const data = response.data;
            const likes = data.like_count || 0;
            const comments = data.comments_count || 0;

            let reach = 0;
            let impressions = 0;
            if (data.insights) {
                const reachData = data.insights.data.find(i => i.name === 'reach');
                const impressionsData = data.insights.data.find(i => i.name === 'impressions');
                reach = reachData?.values[0]?.value || 0;
                impressions = impressionsData?.values[0]?.value || 0;
            }

            return {
                likes,
                comments,
                shares: 0, // IG API doesn't easily expose shares for posts via Graph
                reach,
                impressions
            };
        } catch (error) {
            console.error('Error fetching Instagram metrics:', error.response?.data || error.message);
            throw new Error('Failed to fetch Instagram metrics');
        }
    }

    /**
     * Process all scheduled posts that are due for publishing
     */
    async publishScheduledPosts() {
        try {
            const now = new Date();

            // Fetch all scheduled posts that haven't been posted yet
            const allScheduled = await prisma.scheduledPost.findMany({
                where: { status: 'SCHEDULED' }
            });

            if (allScheduled.length === 0) return { count: 0 };

            // Filter for posts that are actually due for publishing
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
