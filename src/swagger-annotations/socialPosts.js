/**
 * @swagger
 * /api/social-posts:
 *   get:
 *     tags: [Social Posts]
 *     summary: Get all social posts
 *     description: Retrieve a list of all social media posts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by tenant ID (required)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *           enum: [facebook, twitter, instagram, linkedin, youtube, tiktok]
 *         description: Filter by social platform
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, scheduled, published, archived]
 *         description: Filter by post status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search posts by content or title
 *     responses:
 *       200:
 *         description: Social posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/social-posts/{id}:
 *   get:
 *     tags: [Social Posts]
 *     summary: Get social post by ID
 *     description: Retrieve a specific social post by its ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Social post ID
 *     responses:
 *       200:
 *         description: Social post retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     platform:
 *                       type: string
 *                     status:
 *                       type: string
 *                     title:
 *                       type: string
 *                     content:
 *                       type: string
 *                     mediaIds:
 *                       type: array
 *                       items:
 *                         type: string
 *                         format: uuid
 *                     hashtags:
 *                       type: array
 *                       items:
 *                         type: string
 *                     scheduledAt:
 *                       type: string
 *                       format: date-time
 *                     publishedAt:
 *                       type: string
 *                       format: date-time
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Social post not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/social-posts:
 *   post:
 *     tags: [Social Posts]
 *     summary: Create a new social post
 *     description: Create a new social media post
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - platform
 *               - content
 *             properties:
 *               platform:
 *                 type: string
 *                 enum: [facebook, twitter, instagram, linkedin, youtube, tiktok]
 *                 description: Social media platform
 *               title:
 *                 type: string
 *                 description: Post title
 *               content:
 *                 type: string
 *                 description: Post content
 *               mediaIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array of media file IDs
 *               hashtags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of hashtags
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *                 description: Schedule post for specific time
 *               settings:
 *                 type: object
 *                 properties:
 *                   allowComments:
 *                     type: boolean
 *                     description: Allow comments on post
 *                   allowSharing:
 *                     type: boolean
 *                     description: Allow sharing of post
 *                   targetAudience:
 *                     type: string
 *                     enum: [public, friends, private]
 *                     description: Post visibility
 *                 description: Post settings
 *     responses:
 *       201:
 *         description: Social post created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/social-posts/{id}:
 *   put:
 *     tags: [Social Posts]
 *     summary: Update social post
 *     description: Update an existing social post
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Social post ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Post title
 *               content:
 *                 type: string
 *                 description: Post content
 *               mediaIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array of media file IDs
 *               hashtags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of hashtags
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *                 description: Schedule post for specific time
 *               settings:
 *                 type: object
 *                 properties:
 *                   allowComments:
 *                     type: boolean
 *                     description: Allow comments on post
 *                   allowSharing:
 *                     type: boolean
 *                     description: Allow sharing of post
 *                   targetAudience:
 *                     type: string
 *                     enum: [public, friends, private]
 *                     description: Post visibility
 *                 description: Post settings
 *     responses:
 *       200:
 *         description: Social post updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Social post not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/social-posts/{id}:
 *   delete:
 *     tags: [Social Posts]
 *     summary: Delete social post
 *     description: Delete a social post from the system
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Social post ID
 *     responses:
 *       200:
 *         description: Social post deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Social post not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/social-posts/{id}/publish:
 *   post:
 *     tags: [Social Posts]
 *     summary: Publish social post
 *     description: Publish a draft or scheduled social post immediately
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Social post ID
 *     responses:
 *       200:
 *         description: Social post published successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Social post not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/social-media/stats:
 *   get:
 *     tags: [Social Posts]
 *     summary: Get social media statistics
 *     description: Get social media performance and engagement statistics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, year]
 *           default: month
 *         description: Period for statistics
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *           enum: [facebook, twitter, instagram, linkedin, youtube, tiktok]
 *         description: Filter by platform
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for statistics
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for statistics
 *     responses:
 *       200:
 *         description: Social media statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalPosts:
 *                       type: integer
 *                     publishedPosts:
 *                       type: integer
 *                     scheduledPosts:
 *                       type: integer
 *                     draftPosts:
 *                       type: integer
 *                     totalEngagement:
 *                       type: integer
 *                     totalLikes:
 *                       type: integer
 *                     totalShares:
 *                       type: integer
 *                     totalComments:
 *                       type: integer
 *                     engagementRate:
 *                       type: number
 *                     postsByPlatform:
 *                       type: object
 *                       additionalProperties:
 *                         type: integer
 *                     engagementByPeriod:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                           engagement:
 *                             type: integer
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
