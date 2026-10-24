const express = require('express');
const { body } = require('express-validator');
const {
  createCategory,
  getCategories,
  getCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categoryController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate, idParam } = require('../middleware/validate');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect);

const createRules = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('description').optional().isString().trim(),
  body('expectedLifetimeMonths').isInt({ min: 1 }).withMessage('expectedLifetimeMonths must be an integer >= 1').toInt(),
];

const updateRules = [
  idParam(),
  body('name').optional().trim().notEmpty(),
  body('description').optional().isString().trim(),
  body('expectedLifetimeMonths').optional().isInt({ min: 1 }).toInt(),
];

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: Asset category management and expected lifetime settings
 */

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Retrieve all asset categories
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of categories retrieved successfully
 *       401:
 *         description: Unauthorized (Token required)
 *   post:
 *     summary: Create a new asset category
 *     tags: [Categories]
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
 *               - expectedLifetimeMonths
 *             properties:
 *               name:
 *                 type: string
 *                 example: Laptops & Workstations
 *               description:
 *                 type: string
 *                 example: Portable computing hardware for labs and staff
 *               expectedLifetimeMonths:
 *                 type: integer
 *                 example: 36
 *     responses:
 *       201:
 *         description: Category created successfully
 *       400:
 *         description: Validation error or category name already exists
 *       403:
 *         description: Forbidden (Admin or Procurement only)
 */
router
  .route('/')
  .get(getCategories)
  .post(authorize(ROLES.ADMIN, ROLES.PROCUREMENT), createRules, validate, createCategory);

/**
 * @swagger
 * /api/categories/{id}:
 *   get:
 *     summary: Retrieve category details by ID
 *     tags: [Categories]
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
 *         description: Category details retrieved successfully
 *       404:
 *         description: Category not found
 *   put:
 *     summary: Update an existing category
 *     tags: [Categories]
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
 *                 example: High-Performance Laptops
 *               description:
 *                 type: string
 *                 example: Upgraded laptops for engineering departments
 *               expectedLifetimeMonths:
 *                 type: integer
 *                 example: 48
 *     responses:
 *       200:
 *         description: Category updated successfully
 *       404:
 *         description: Category not found
 *       403:
 *         description: Forbidden (Admin or Procurement only)
 *   delete:
 *     summary: Delete a category
 *     tags: [Categories]
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
 *         description: Category deleted successfully
 *       400:
 *         description: Cannot delete category associated with existing assets
 *       403:
 *         description: Forbidden (Admin only)
 */
router
  .route('/:id')
  .get(idParam(), validate, getCategory)
  .put(authorize(ROLES.ADMIN, ROLES.PROCUREMENT), updateRules, validate, updateCategory)
  .delete(authorize(ROLES.ADMIN), idParam(), validate, deleteCategory);

module.exports = router;