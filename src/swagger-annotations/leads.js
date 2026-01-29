/**
 * @swagger
 * /api/leads:
 *   get:
 *     tags:
 *       - Leads
 *     summary: Get all leads
 *     description: Retrieve a list of all leads with optional filters
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
 *           type: integer
 *           enum: [1, 2, 3, 4, 5]
 *         description: Filter by lead status
 *       - in: query
 *         name: source
 *         schema:
 *           type: integer
 *           enum: [1, 2, 3, 4, 5, 6, 7]
 *         description: Filter by lead source
 *       - in: query
 *         name: propertyId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by property ID
 *       - in: query
 *         name: unitId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by unit ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by end date
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search leads by name or email
 *     responses:
 *       200:
 *         description: Leads retrieved successfully
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
 * /api/leads/{id}:
 *   get:
 *     tags: [Leads]
 *     summary: Get lead by ID
 *     description: Retrieve a specific lead by its ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Lead ID
 *       - in: query
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by tenant ID (required)
 *     responses:
 *       200:
 *         description: Lead retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Lead'
 *       404:
 *         description: Lead not found
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
 * /api/leads:
 *   post:
 *     tags: [Leads]
 *     summary: Create a new lead
 *     description: Create a new lead in the system
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tenantId
 *               - name
 *               - email
 *               - message
 *             properties:
 *               tenantId:
 *                 type: string
 *                 format: uuid
 *                 description: Tenant ID (required)
 *               name:
 *                 type: string
 *                 description: Lead name
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Lead email
 *               phone:
 *                 type: string
 *                 description: Lead phone number
 *               message:
 *                 type: string
 *                 description: Lead message
 *               source:
 *                 type: integer
 *                 enum: [1, 2, 3, 4, 5, 6, 7]
 *                 description: 1: website, 2: email, 3: phone, 4: social, 5: referral, 6: other, 7: chatbot
 *               propertyId:
 *                 type: string
 *                 format: uuid
 *                 description: Associated property ID
 *               unitId:
 *                 type: string
 *                 format: uuid
 *                 description: Associated unit ID
 *               budget:
 *                 type: number
 *                 description: Lead budget
 *     responses:
 *       201:
 *         description: Lead created successfully
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
 * /api/leads/{id}:
 *   put:
 *     tags: [Leads]
 *     summary: Update lead
 *     description: Update an existing lead
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Lead ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tenantId
 *             properties:
 *               tenantId:
 *                 type: string
 *                 format: uuid
 *                 description: Tenant ID (required)
 *               name:
 *                 type: string
 *                 description: Lead name
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Lead email
 *               phone:
 *                 type: string
 *                 description: Lead phone number
 *               message:
 *                 type: string
 *                 description: Lead message
 *               status:
 *                 type: integer
 *                 enum: [1, 2, 3, 4, 5]
 *                 description: Lead status
 *               notes:
 *                 type: string
 *                 description: Lead notes
 *     responses:
 *       200:
 *         description: Lead updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Lead not found
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
 * /api/leads/{id}:
 *   delete:
 *     tags: [Leads]
 *     summary: Delete lead
 *     description: Delete a lead from the system
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Lead ID
 *       - in: query
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by tenant ID (required)
 *     responses:
 *       200:
 *         description: Lead deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Lead not found
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
 * /api/leads/{id}/convert:
 *   post:
 *     tags: [Leads]
 *     summary: Convert lead to booking
 *     description: Convert a lead into a booking
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Lead ID
 *       - in: query
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by tenant ID (required)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - unitId
 *               - startAt
 *               - endAt
 *             properties:
 *               unitId:
 *                 type: string
 *                 format: uuid
 *                 description: Unit ID to book
 *               startAt:
 *                 type: string
 *                 format: date-time
 *                 description: Booking start time
 *               endAt:
 *                 type: string
 *                 format: date-time
 *                 description: Booking end time
 *     responses:
 *       201:
 *         description: Lead converted to booking successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Lead not found
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
 * /api/leads/stats:
 *   get:
 *     tags: [Leads]
 *     summary: Get lead statistics
 *     description: Get lead generation and conversion statistics
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
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, year]
 *           default: month
 *         description: Period for statistics
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
 *         description: Lead statistics retrieved successfully
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
 *                     totalLeads:
 *                       type: integer
 *                     newLeads:
 *                       type: integer
 *                     convertedLeads:
 *                       type: integer
 *                     conversionRate:
 *                       type: number
 *                     leadsBySource:
 *                       type: object
 *                       additionalProperties:
 *                         type: integer
 *                     leadsByStatus:
 *                       type: object
 *                       additionalProperties:
 *                         type: integer
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
