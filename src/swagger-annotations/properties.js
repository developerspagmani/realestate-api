/**
 * @swagger
 * /api/properties:
 *   post:
 *     tags:
 *       - Properties
 *     summary: Create a new property
 *     description: Create a new property in the system
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
 *               - title
 *               - addressLine1
 *               - city
 *               - state
 *               - country
 *             properties:
 *               tenantId:
 *                 type: string
 *                 format: uuid
 *                 description: Tenant ID for multi-tenant property
 *               title:
 *                 type: string
 *                 description: Property title
 *               description:
 *                 type: string
 *                 description: Property description
 *               addressLine1:
 *                 type: string
 *                 description: Property address line 1
 *               addressLine2:
 *                 type: string
 *                 description: Property address line 2
 *               city:
 *                 type: string
 *                 description: Property city
 *               state:
 *                 type: string
 *                 description: Property state
 *               country:
 *                 type: string
 *                 description: Property country
 *               postalCode:
 *                 type: string
 *                 description: Property postal code
 *               latitude:
 *                 type: number
 *                 description: Property latitude
 *               longitude:
 *                 type: number
 *                 description: Property longitude
 *               propertyType:
 *                 type: integer
 *                 enum:
 *                   - 1
 *                   - 2
 *                   - 3
 *                   - 4
 *                 description: 1: residential, 2: commercial, 3: industrial, 4: mixed
 *     responses:
 *       201:
 *         description: Property created successfully
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
 * /api/properties:
 *   get:
 *     tags:
*       - Properties
 *     summary: Get all properties
 *     description: Retrieve a list of all properties
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
 *         name: propertyType
 *         schema:
 *           type: integer
 *           enum:
 *             - 1
 *             - 2
 *             - 3
 *             - 4
 *         description: Filter by property type
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city
 *       - in: query
 *         name: status
 *         schema:
 *           type: integer
 *           enum:
 *             - 1
 *             - 2
 *             - 3
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Properties retrieved successfully
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
 * /api/properties/{id}:
 *   get:
 *     tags:
*       - Properties
 *     summary: Get property by ID
 *     description: Retrieve a specific property by its ID
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
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Property ID
 *     responses:
 *       200:
 *         description: Property retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Property'
 *       404:
 *         description: Property not found
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
 * /api/properties/{id}:
 *   put:
 *     tags:
*       - Properties
 *     summary: Update property
 *     description: Update an existing property
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
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Property ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tenantId:
 *                 type: string
 *                 format: uuid
 *                 description: Tenant ID for multi-tenant property
 *               title:
 *                 type: string
 *                 description: Property title
 *               description:
 *                 type: string
 *                 description: Property description
 *               addressLine1:
 *                 type: string
 *                 description: Property address line 1
 *               addressLine2:
 *                 type: string
 *                 description: Property address line 2
 *               city:
 *                 type: string
 *                 description: Property city
 *               state:
 *                 type: string
 *                 description: Property state
 *               country:
 *                 type: string
 *                 description: Property country
 *               postalCode:
 *                 type: string
 *                 description: Property postal code
 *               latitude:
 *                 type: number
 *                 description: Property latitude
 *               longitude:
 *                 type: number
 *                 description: Property longitude
 *               status:
 *                 type: integer
 *                 enum:
 *                   - 1
 *                   - 2
 *                   - 3
 *                 description: 1: active, 2: inactive, 3: archived
 *     responses:
 *       200:
 *         description: Property updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Property not found
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
 * /api/properties/{id}:
 *   delete:
 *     tags:
*       - Properties
 *     summary: Delete property
 *     description: Delete a property (soft delete)
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
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Property ID
 *     responses:
 *       200:
 *         description: Property deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Property not found
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
