/**
 * @swagger
 * /api/campaigns:
 *   get:
 *     tags: [Campaigns]
 *     summary: Get all campaigns
 *     description: Retrieve a list of all marketing campaigns
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, active, paused, completed, cancelled]
 *         description: Filter by campaign status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [email, social, sms, push, display]
 *         description: Filter by campaign type
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search campaigns by name or subject
 *     responses:
 *       200:
 *         description: Campaigns retrieved successfully
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
 * /api/campaigns/{id}:
 *   get:
 *     tags: [Campaigns]
 *     summary: Get campaign by ID
 *     description: Retrieve a specific campaign by its ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Campaign ID
 *     responses:
 *       200:
 *         description: Campaign retrieved successfully
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
 *                     name:
 *                       type: string
 *                     type:
 *                       type: string
 *                     status:
 *                       type: string
 *                     subject:
 *                       type: string
 *                     content:
 *                       type: string
 *                     targetAudience:
 *                       type: object
 *                     scheduledAt:
 *                       type: string
 *                       format: date-time
 *                     sentAt:
 *                       type: string
 *                       format: date-time
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Campaign not found
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
 * /api/campaigns:
 *   post:
 *     tags: [Campaigns]
 *     summary: Create a new campaign
 *     description: Create a new marketing campaign
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - subject
 *               - content
 *             properties:
 *               name:
 *                 type: string
 *                 description: Campaign name
 *               type:
 *                 type: string
 *                 enum: [email, social, sms, push, display]
 *                 description: Campaign type
 *               subject:
 *                 type: string
 *                 description: Campaign subject line
 *               content:
 *                 type: string
 *                 description: Campaign content
 *               targetAudience:
 *                 type: object
 *                 properties:
 *                   users:
 *                     type: array
 *                     items:
 *                       type: string
 *                       format: uuid
 *                     description: Array of user IDs
 *                   roles:
 *                     type: array
 *                     items:
 *                       type: string
 *                       enum: [USER, ADMIN, OWNER]
 *                     description: Array of user roles
 *                   properties:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: Array of property types
 *                   locations:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: Array of locations
 *                 description: Target audience configuration
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *                 description: Schedule campaign for specific time
 *               settings:
 *                 type: object
 *                 properties:
 *                   sendImmediately:
 *                     type: boolean
 *                     description: Send campaign immediately
 *                   trackOpens:
 *                     type: boolean
 *                     default: true
 *                     description: Track email opens
 *                   trackClicks:
 *                     type: boolean
 *                     default: true
 *                     description: Track link clicks
 *                 description: Campaign settings
 *     responses:
 *       201:
 *         description: Campaign created successfully
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
 * /api/campaigns/{id}:
 *   put:
 *     tags: [Campaigns]
 *     summary: Update campaign
 *     description: Update an existing campaign
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Campaign ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Campaign name
 *               subject:
 *                 type: string
 *                 description: Campaign subject line
 *               content:
 *                 type: string
 *                 description: Campaign content
 *               targetAudience:
 *                 type: object
 *                 properties:
 *                   users:
 *                     type: array
 *                     items:
 *                       type: string
 *                       format: uuid
 *                     description: Array of user IDs
 *                   roles:
 *                     type: array
 *                     items:
 *                       type: string
 *                       enum: [USER, ADMIN, OWNER]
 *                     description: Array of user roles
 *                   properties:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: Array of property types
 *                   locations:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: Array of locations
 *                 description: Target audience configuration
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *                 description: Schedule campaign for specific time
 *     responses:
 *       200:
 *         description: Campaign updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Campaign not found
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
 * /api/campaigns/{id}:
 *   delete:
 *     tags: [Campaigns]
 *     summary: Delete campaign
 *     description: Delete a campaign from the system
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Campaign ID
 *     responses:
 *       200:
 *         description: Campaign deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Campaign not found
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
 * /api/campaigns/{id}/launch:
 *   post:
 *     tags: [Campaigns]
 *     summary: Launch campaign
 *     description: Launch a campaign immediately
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Campaign ID
 *     responses:
 *       200:
 *         description: Campaign launched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Campaign not found
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
 * /api/campaigns/{id}/stats:
 *   get:
 *     tags: [Campaigns]
 *     summary: Get campaign statistics
 *     description: Get performance statistics for a specific campaign
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Campaign ID
 *     responses:
 *       200:
 *         description: Campaign statistics retrieved successfully
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
 *                     totalSent:
 *                       type: integer
 *                     totalDelivered:
 *                       type: integer
 *                     totalOpened:
 *                       type: integer
 *                     totalClicked:
 *                       type: integer
 *                     totalBounced:
 *                       type: integer
 *                     totalUnsubscribed:
 *                       type: integer
 *                     openRate:
 *                       type: number
 *                     clickRate:
 *                       type: number
 *                     bounceRate:
 *                       type: number
 *                     unsubscribeRate:
 *                       type: number
 *       404:
 *         description: Campaign not found
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
