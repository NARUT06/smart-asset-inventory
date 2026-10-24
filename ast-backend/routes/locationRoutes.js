const express = require('express');
const { body, query } = require('express-validator');
const {
  createLocation,
  getLocations,
  getLocationTree,
  getLocation,
  getChildren,
  updateLocation,
  deleteLocation,
} = require('../controllers/locationController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate, idParam, ID_OPTS } = require('../middleware/validate');
const { ROLES, LOCATION_TYPES } = require('../config/constants');

const router = express.Router();
router.use(protect);

const types = Object.values(LOCATION_TYPES);

const createRules = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('code').trim().notEmpty().withMessage('code is required'),
  body('type').isIn(types).withMessage(`type must be one of: ${types.join(', ')}`),
  body('parentId').optional({ nullable: true }).isInt(ID_OPTS).withMessage('Invalid parentId').toInt(),
];

const updateRules = [
  idParam(),
  body('name').optional().trim().notEmpty(),
  body('code').optional().trim().notEmpty(),
  body('type').optional().isIn(types),
  body('parentId').optional({ nullable: true }).isInt(ID_OPTS).withMessage('Invalid parentId').toInt(),
];

/**
 * @swagger
 * tags:
 *   name: Locations
 *   description: Hierarchical location and physical facility structure management
 */

/**
 * @swagger
 * /api/locations:
 *   get:
 *     summary: Retrieve locations with optional type and parent filters
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [CAMPUS, BUILDING, FLOOR, ROOM, OFFICE, LAB, STORAGE]
 *         description: Filter locations by structural type
 *       - in: query
 *         name: parentId
 *         schema:
 *           type: string
 *         description: Filter by parent location ID, or 'null' for root locations (CAMPUS)
 *     responses:
 *       200:
 *         description: List of locations retrieved successfully
 *       401:
 *         description: Unauthorized (Token required)
 *   post:
 *     summary: Create a new location node in the facility hierarchy
 *     description: Hierarchy rules must be respected (BUILDING must have a CAMPUS parent, FLOOR must have a BUILDING parent, and ROOM/LAB/OFFICE/STORAGE must have a FLOOR parent).
 *     tags: [Locations]
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
 *               - code
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 example: Electronics Lab 202
 *               code:
 *                 type: string
 *                 example: LAB-202
 *               type:
 *                 type: string
 *                 enum: [CAMPUS, BUILDING, FLOOR, ROOM, OFFICE, LAB, STORAGE]
 *                 example: LAB
 *               parentId:
 *                 type: integer
 *                 example: 3
 *                 description: Parent location ID (e.g. Floor ID 3)
 *     responses:
 *       201:
 *         description: Location created successfully
 *       400:
 *         description: Validation error or invalid parent location type hierarchy
 *       403:
 *         description: Forbidden (Admin only)
 */
router
  .route('/')
  .get(
    [
      query('type').optional().isIn(types),
      query('parentId')
        .optional()
        .custom((v) => v === 'null' || (/^\d+$/.test(v) && Number(v) >= ID_OPTS.min && Number(v) <= ID_OPTS.max))
        .withMessage('Invalid parentId'),
    ],
    validate,
    getLocations
  )
  .post(authorize(ROLES.ADMIN), createRules, validate, createLocation);

/**
 * @swagger
 * /api/locations/tree:
 *   get:
 *     summary: Retrieve complete hierarchical tree structure of locations
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: rootId
 *         schema:
 *           type: integer
 *         description: Optional root node ID to fetch a specific subtree
 *     responses:
 *       200:
 *         description: Hierarchical location tree retrieved successfully
 *       401:
 *         description: Unauthorized
 */
// Must be declared before '/:id'
router.get('/tree', [query('rootId').optional().isInt(ID_OPTS).toInt()], validate, getLocationTree);

/**
 * @swagger
 * /api/locations/{id}/children:
 *   get:
 *     summary: Retrieve direct child locations under a specific node
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Parent location ID
 *     responses:
 *       200:
 *         description: Direct child locations retrieved successfully
 *       404:
 *         description: Location not found
 */
router.get('/:id/children', idParam(), validate, getChildren);

/**
 * @swagger
 * /api/locations/{id}:
 *   get:
 *     summary: Retrieve details of a specific location by ID
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Location ID
 *     responses:
 *       200:
 *         description: Location details retrieved successfully
 *       404:
 *         description: Location not found
 *   put:
 *     summary: Update an existing location node
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Advanced Robotics Lab
 *               code:
 *                 type: string
 *                 example: ROB-202
 *               type:
 *                 type: string
 *                 enum: [CAMPUS, BUILDING, FLOOR, ROOM, OFFICE, LAB, STORAGE]
 *               parentId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Location updated successfully
 *       400:
 *         description: Validation error or invalid hierarchy modification
 *       403:
 *         description: Forbidden (Admin only)
 *       404:
 *         description: Location not found
 *   delete:
 *     summary: Delete a location node
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Location deleted successfully
 *       400:
 *         description: Cannot delete location with child locations or assigned assets
 *       403:
 *         description: Forbidden (Admin only)
 */
router
  .route('/:id')
  .get(idParam(), validate, getLocation)
  .put(authorize(ROLES.ADMIN), updateRules, validate, updateLocation)
  .delete(authorize(ROLES.ADMIN), idParam(), validate, deleteLocation);

module.exports = router;