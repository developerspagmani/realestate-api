/**
 * @swagger
 * /api/workspaces:
 *   get:
 *     tags: [Workspaces]
 *     summary: Get all workspaces
 *     description: Retrieve a list of all workspace seats with optional filters
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
 *         name: propertyId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by property ID
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [desk, cabin, meeting_room, event_space]
 *         description: Filter by workspace type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [available, occupied, maintenance, unavailable]
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
 *       - in: query
 *         name: amenities
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *           description: Filter by amenities
 *     responses:
 *       200:
 *         description: Workspaces retrieved successfully
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
 * /api/workspaces/{id}:
 *   get:
 *     tags: [Workspaces]
 *     summary: Get workspace by ID
 *     description: Retrieve a specific workspace by its ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Workspace ID
 *     responses:
 *       200:
 *         description: Workspace retrieved successfully
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
 *                     propertyId:
 *                       type: string
 *                       format: uuid
 *                     type:
 *                       type: string
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     capacity:
 *                       type: integer
 *                     hourlyRate:
 *                       type: number
 *                     dailyRate:
 *                       type: number
 *                     monthlyRate:
 *                       type: number
 *                     amenities:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           name:
 *                             type: string
 *                           category:
 *                             type: string
 *                     status:
 *                       type: string
 *                     availability:
 *                       type: object
 *                       properties:
 *                         isAvailable:
 *                           type: boolean
 *                         nextAvailable:
 *                           type: string
 *                           format: date-time
 *       404:
 *         description: Workspace not found
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
 * /api/workspaces:
 *   post:
 *     tags: [Workspaces]
 *     summary: Create a new workspace
 *     description: Create a new workspace seat in the system
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - propertyId
 *               - name
 *               - type
 *               - capacity
 *             properties:
 *               propertyId:
 *                 type: string
 *                 format: uuid
 *                 description: Associated property ID
 *               name:
 *                 type: string
 *                 description: Workspace name
 *               type:
 *                 type: string
 *                 enum: [desk, cabin, meeting_room, event_space]
 *                 description: Workspace type
 *               description:
 *                 type: string
 *                 description: Workspace description
 *               capacity:
 *                 type: integer
 *                 description: Workspace capacity
 *               hourlyRate:
 *                 type: number
 *                 description: Hourly rate
 *               dailyRate:
 *                 type: number
 *                 description: Daily rate
 *               monthlyRate:
 *                 type: number
 *                 description: Monthly rate
 *               amenities:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array of amenity IDs
 *               features:
 *                 type: object
 *                 properties:
 *                   hasWifi:
 *                     type: boolean
 *                     description: WiFi available
 *                   hasProjector:
 *                     type: boolean
 *                     description: Projector available
 *                   hasWhiteboard:
 *                     type: boolean
 *                     description: Whiteboard available
 *                   hasParking:
 *                     type: boolean
 *                     description: Parking available
 *                   hasKitchen:
 *                     type: boolean
 *                     description: Kitchen access
 *                 description: Workspace features
 *     responses:
 *       201:
 *         description: Workspace created successfully
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
 * /api/workspaces/{id}:
 *   put:
 *     tags: [Workspaces]
 *     summary: Update workspace
 *     description: Update an existing workspace
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Workspace ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Workspace name
 *               type:
 *                 type: string
 *                 enum: [desk, cabin, meeting_room, event_space]
 *                 description: Workspace type
 *               description:
 *                 type: string
 *                 description: Workspace description
 *               capacity:
 *                 type: integer
 *                 description: Workspace capacity
 *               hourlyRate:
 *                 type: number
 *                 description: Hourly rate
 *               dailyRate:
 *                 type: number
 *                 description: Daily rate
 *               monthlyRate:
 *                 type: number
 *                 description: Monthly rate
 *               status:
 *                 type: string
 *                 enum: [available, occupied, maintenance, unavailable]
 *                 description: Workspace status
 *               amenities:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array of amenity IDs
 *               features:
 *                 type: object
 *                 properties:
 *                   hasWifi:
 *                     type: boolean
 *                     description: WiFi available
 *                   hasProjector:
 *                     type: boolean
 *                     description: Projector available
 *                   hasWhiteboard:
 *                     type: boolean
 *                     description: Whiteboard available
 *                   hasParking:
 *                     type: boolean
 *                     description: Parking available
 *                   hasKitchen:
 *                     type: boolean
 *                     description: Kitchen access
 *                 description: Workspace features
 *     responses:
 *       200:
 *         description: Workspace updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Workspace not found
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
 * /api/workspaces/{id}:
 *   delete:
 *     tags: [Workspaces]
 *     summary: Delete workspace
 *     description: Delete a workspace from the system
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Workspace ID
 *     responses:
 *       200:
 *         description: Workspace deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Workspace not found
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
 * /api/workspaces/{id}/availability:
 *   get:
 *     tags: [Workspaces]
 *     summary: Get workspace availability
 *     description: Check availability of a specific workspace for given dates
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Workspace ID
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
 *       - in: query
 *         name: startTime
 *         schema:
 *           type: string
 *           format: time
 *         description: Start time for availability check
 *       - in: query
 *         name: endTime
 *         schema:
 *           type: string
 *           format: time
 *         description: End time for availability check
 *     responses:
 *       200:
 *         description: Workspace availability retrieved successfully
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
 *                           date:
 *                             type: string
 *                             format: date
 *                           startTime:
 *                             type: string
 *                             format: time
 *                           endTime:
 *                             type: string
 *                             format: time
 *                           availableSeats:
 *                             type: integer
 *       404:
 *         description: Workspace not found
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
