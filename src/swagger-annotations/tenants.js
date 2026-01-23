/**
 * @swagger
 * /api/tenants:
 *   get:
 *     tags:
 *       - Tenants
 *     summary: Get all tenants
 *     description: Retrieve a list of all tenants (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         name: type
 *         schema:
 *           type: integer
 *           enum: [1, 2, 3]
 *         description: Filter by tenant type
 *       - in: query
 *         name: status
 *         schema:
 *           type: integer
 *           enum: [1, 2, 3]
 *         description: Filter by tenant status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search tenants by name or domain
 *     responses:
 *       200:
 *         description: Tenants retrieved successfully
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
 *       403:
 *         description: Forbidden - admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/tenants/{id}:
 *   get:
 *     tags: [Tenants]
 *     summary: Get tenant by ID
 *     description: Retrieve a specific tenant by its ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Tenant ID
 *     responses:
 *       200:
 *         description: Tenant retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Tenant'
 *       404:
 *         description: Tenant not found
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
 * /api/tenants:
 *   post:
 *     tags: [Tenants]
 *     summary: Create a new tenant
 *     description: Create a new tenant in the system
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
 *             properties:
 *               name:
 *                 type: string
 *                 description: Tenant name
 *               type:
 *                 type: integer
 *                 enum: [1, 2, 3]
 *                 description: 1: Real Estate, 2: Co-working, 3: Mixed
 *               domain:
 *                 type: string
 *                 description: Tenant domain (optional)
 *               settings:
 *                 type: object
 *                 properties:
 *                   maxUsers:
 *                     type: integer
 *                     description: Maximum allowed users
 *                   defaultCurrency:
 *                     type: string
 *                     description: Default currency
 *                   timezone:
 *                     type: string
 *                     description: Tenant timezone
 *                   features:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: Enabled features
 *                 description: Tenant settings
 *               adminUser:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     description: Admin user name
 *                   email:
 *                     type: string
 *                     format: email
 *                     description: Admin user email
 *                   password:
 *                     type: string
 *                     minLength: 6
 *                     description: Admin user password
 *                 description: Admin user details
 *     responses:
 *       201:
 *         description: Tenant created successfully
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
 * /api/tenants/{id}:
 *   put:
 *     tags: [Tenants]
 *     summary: Update tenant
 *     description: Update an existing tenant
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Tenant ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Tenant name
 *               domain:
 *                 type: string
 *                 description: Tenant domain
 *               status:
 *                 type: integer
 *                 enum: [1, 2, 3]
 *                 description: 1: active, 2: inactive, 3: suspended
 *               settings:
 *                 type: object
 *                 properties:
 *                   maxUsers:
 *                     type: integer
 *                     description: Maximum allowed users
 *                   defaultCurrency:
 *                     type: string
 *                     description: Default currency
 *                   timezone:
 *                     type: string
 *                     description: Tenant timezone
 *                   features:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: Enabled features
 *                 description: Tenant settings
 *     responses:
 *       200:
 *         description: Tenant updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Tenant not found
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
 * /api/tenants/{id}:
 *   delete:
 *     tags: [Tenants]
 *     summary: Delete tenant
 *     description: Delete a tenant from the system (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Tenant ID
 *     responses:
 *       200:
 *         description: Tenant deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Tenant not found
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
 * /api/tenants/{id}/stats:
 *   get:
 *     tags: [Tenants]
 *     summary: Get tenant statistics
 *     description: Get usage and performance statistics for a specific tenant
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Tenant ID
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
 *         description: Tenant statistics retrieved successfully
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
 *                     totalUsers:
 *                       type: integer
 *                     activeUsers:
 *                       type: integer
 *                     totalProperties:
 *                       type: integer
 *                     activeProperties:
 *                       type: integer
 *                     totalBookings:
 *                       type: integer
 *                     revenue:
 *                       type: number
 *                     storageUsed:
 *                       type: integer
 *                     apiCalls:
 *                       type: integer
 *       404:
 *         description: Tenant not found
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
