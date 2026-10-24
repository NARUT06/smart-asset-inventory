const express = require('express');
const { body } = require('express-validator');
const {
    getTemplates,
    createTemplate,
} = require('../controllers/maintenanceTemplateController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect);

const createRules = [
    body('title').trim().notEmpty().withMessage('title is required'),
    body('intervalDays')
        .isInt({ min: 1 })
        .withMessage('intervalDays must be an integer >= 1'),
    body('categoryId').isInt().withMessage('valid categoryId is required'),
];

/**
 * @swagger
 * tags:
 *   name: MaintenanceTemplates
 *   description: Reusable recurring preventive maintenance schedules and standard operating procedures
 */

/**
 * @swagger
 * /api/maintenance-templates:
 *   get:
 *     summary: Retrieve all maintenance schedule templates
 *     tags: [MaintenanceTemplates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of maintenance templates retrieved successfully
 *       401:
 *         description: Unauthorized (Token required)
 *   post:
 *     summary: Create a standard recurring maintenance template for a category
 *     tags: [MaintenanceTemplates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - intervalDays
 *               - categoryId
 *             properties:
 *               title:
 *                 type: string
 *                 example: Quarterly Hardware Diagnostic & Thermal Inspection
 *               intervalDays:
 *                 type: integer
 *                 example: 90
 *                 description: Recurring interval period in days
 *               categoryId:
 *                 type: integer
 *                 example: 5
 *                 description: Target category ID (e.g., Laptops & Workstations)
 *     responses:
 *       201:
 *         description: Maintenance template created successfully
 *       400:
 *         description: Validation error or invalid category ID
 *       403:
 *         description: Forbidden (Admin or Procurement only)
 */
router
    .route('/')
    .get(getTemplates)
    .post(
        authorize(ROLES.ADMIN, ROLES.PROCUREMENT),
        createRules,
        validate,
        createTemplate,
    );

module.exports = router;