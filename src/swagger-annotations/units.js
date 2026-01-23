/**
 * @swagger
 * /api/units:
 *   get:
 *     tags:
*       - Units
 *     summary: Get all units
 *     description: Retrieve a list of all units with optional filters
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
 *         name: propertyId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by property ID
 *       - in: query
 *         name: unitCategory
 *         schema:
 *           type: integer
 *           enum:
 *             - 1
 *             - 2
 *             - 3
 *             - 4
 *         description: Filter by unit category
 *       - in: query
 *         name: status
 *         schema:
 *           type: integer
 *           enum:
 *             - 1
 *             - 2
 *             - 3
 *             - 4
 *         description: Filter by status
 *       - in: query
 *         name: minCapacity
 *         schema:
 *           type: integer
 *         description: Minimum capacity filter
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price filter
 *     responses:
 *       200:
 *         description: Units retrieved successfully
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
 * /api/units/{id}:
 *   get:
 *     tags:
*       - Units
 *     summary: Get unit by ID
 *     description: Retrieve a specific unit by its ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unit ID
 *     responses:
 *       200:
 *         description: Unit retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Unit'
 *       404:
 *         description: Unit not found
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
 * /api/units:
 *   post:
 *     tags:
*       - Units
 *     summary: Create a new unit
 *     description: Create a new unit in the system
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
 *               - propertyId
 *               - unitCategory
 *             properties:
 *               tenantId:
 *                 type: string
 *                 format: uuid
 *                 description: Tenant ID for multi-tenant unit
 *               propertyId:
 *                 type: string
 *                 format: uuid
 *                 description: Associated property ID
 *               unitCategory:
 *                 type: integer
 *                 enum:
 *                   - 1
 *                   - 2
 *                   - 3
 *                   - 4
 *                 description: 1: residential, 2: commercial, 3: industrial, 4: mixed
 *               unitCode:
 *                 type: string
 *                 description: Unit code
 *               floorNo:
 *                 type: integer
 *                 description: Floor number
 *               capacity:
 *                 type: integer
 *                 description: Unit capacity
 *               sizeSqft:
 *                 type: integer
 *                 description: Unit size in square feet
 *               pricing:
 *                 type: object
 *                 properties:
 *                   pricingModel:
 *                     type: integer
 *                     enum:
 *                       - 1
 *                       - 2
 *                       - 3
 *                       - 4
 *                       - 5
 *                     description: 1: fixed, 2: hourly, 3: daily, 4: monthly, 5: yearly
 *                   price:
 *                     type: number
 *                     description: Unit price
 *                   currency:
 *                     type: string
 *                     description: Price currency
 *               amenities:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array of amenity IDs
 *     responses:
 *       201:
 *         description: Unit created successfully
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
 * /api/units/{id}:
 *   put:
 *     tags:
*       - Units
 *     summary: Update unit
 *     description: Update an existing unit
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unit ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               unitCategory:
 *                 type: integer
 *                 enum:
 *                   - 1
 *                   - 2
 *                   - 3
 *                   - 4
 *                 description: 1: residential, 2: commercial, 3: industrial, 4: mixed
 *               unitCode:
 *                 type: string
 *                 description: Unit code
 *               floorNo:
 *                 type: integer
 *                 description: Floor number
 *               capacity:
 *                 type: integer
 *                 description: Unit capacity
 *               sizeSqft:
 *                 type: integer
 *                 description: Unit size in square feet
 *               status:
 *                 type: integer
 *                 enum: [1, 2, 3, 4]
 *                 description: 1: available, 2: occupied, 3: maintenance, 4: inactive
 *               pricing:
 *                 type: object
 *                 properties:
 *                   pricingModel:
 *                     type: integer
 *                     enum:
 *                       - 1
 *                       - 2
 *                       - 3
 *                       - 4
 *                       - 5
 *                     description: 1: fixed, 2: hourly, 3: daily, 4: monthly, 5: yearly
 *                   price:
 *                     type: number
 *                     description: Unit price
 *                   currency:
 *                     type: string
 *                     description: Price currency
 *     responses:
 *       200:
 *         description: Unit updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Unit not found
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
 * /api/units/{id}:
 *   delete:
 *     tags:
*       - Units
 *     summary: Delete unit
 *     description: Delete a unit (soft delete)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unit ID
 *     responses:
 *       200:
 *         description: Unit deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Unit not found
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
 * /api/units/{id}/availability:
 *   get:
 *     tags:
*       - Units
 *     summary: Get unit availability
 *     description: Check availability of a specific unit for given dates
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Unit ID
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for availability check
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for availability check
 *     responses:
 *       200:
 *         description: Unit availability retrieved successfully
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
 *                     isAvailable:
 *                       type: boolean
 *                     availableSlots:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           startAt:
 *                             type: string
 *                             format: date-time
 *                           endAt:
 *                             type: string
 *                             format: date-time
 *       404:
 *         description: Unit not found
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
