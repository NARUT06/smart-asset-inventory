const express = require('express');
const { body, query } = require('express-validator');
const {
  createWorkOrder,
  getWorkOrders,
  getWorkOrder,
  getAssetMaintenanceSummary,
  updateWorkOrder,
  changeWorkOrderStatus,
  deleteWorkOrder,
} = require('../controllers/workOrderController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate, idParam, ID_OPTS } = require('../middleware/validate');
const {
  ROLES,
  WORK_ORDER_TYPE,
  WORK_ORDER_PRIORITY,
  WORK_ORDER_STATUS,
} = require('../config/constants');

const router = express.Router();
router.use(protect);

const types = Object.values(WORK_ORDER_TYPE);
const priorities = Object.values(WORK_ORDER_PRIORITY);
const statuses = Object.values(WORK_ORDER_STATUS);

const checklistRules = [
  body('checklist').optional().isArray({ max: 100 }).withMessage('checklist must be an array'),
  body('checklist.*.task').optional().isString().trim().notEmpty().withMessage('Each checklist item needs a task'),
  body('checklist.*.isDone').optional().isBoolean().toBoolean(),
  body('checklist.*.note').optional().isString().trim(),
];

const costRules = [
  body('partsUsed').optional().isString().trim(),
  body('partsCost').optional().isFloat({ min: 0 }).toFloat(),
  body('downtimeHours').optional().isFloat({ min: 0 }).toFloat(),
  body('completionNotes').optional().isString().trim(),
];

const listRules = [
  query('assetId').optional().isInt(ID_OPTS).toInt(),
  query('technicianId').optional().isInt(ID_OPTS).toInt(),
  query('status').optional().isIn(statuses),
  query('priority').optional().isIn(priorities),
  query('type').optional().isIn(types),
  query('dueBefore').optional().isISO8601(),
];

/**
 * @swagger
 * tags:
 *   name: WorkOrders
 *   description: Maintenance work order management, task checklists, and cost tracking
 */

/**
 * @swagger
 * /api/work-orders:
 *   get:
 *     summary: Retrieve maintenance work orders with filtering options
 *     tags: [WorkOrders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: assetId
 *         schema:
 *           type: integer
 *         description: Filter work orders by asset ID
 *       - in: query
 *         name: technicianId
 *         schema:
 *           type: integer
 *         description: Filter by assigned technician ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [CORRECTIVE, SCHEDULED]
 *       - in: query
 *         name: dueBefore
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter work orders scheduled or due before this date
 *     responses:
 *       200:
 *         description: List of work orders retrieved successfully
 *       401:
 *         description: Unauthorized (Token required)
 *   post:
 *     summary: Create a new maintenance work order
 *     tags: [WorkOrders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - assetId
 *             properties:
 *               assetId:
 *                 type: integer
 *                 example: 2
 *               type:
 *                 type: string
 *                 enum: [CORRECTIVE, SCHEDULED]
 *                 example: SCHEDULED
 *               title:
 *                 type: string
 *                 example: Biannual Hardware Health Check
 *               description:
 *                 type: string
 *                 example: Perform thermal paste replacement, clean internal fans, and test memory modules.
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *                 example: MEDIUM
 *               technicianId:
 *                 type: integer
 *                 example: 4
 *                 description: Assign to technician Mohamed (User ID 4)
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *                 example: 2026-10-01T09:00:00.000Z
 *               intervalDays:
 *                 type: integer
 *                 example: 180
 *               checklist:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     task:
 *                       type: string
 *                       example: Fan dust clean-up
 *                     isDone:
 *                       type: boolean
 *                       example: false
 *                     note:
 *                       type: string
 *                       example: Use compressed air
 *     responses:
 *       201:
 *         description: Work order created successfully
 *       400:
 *         description: Validation error or invalid asset ID
 *       403:
 *         description: Forbidden (Admin, Custodian, or Technician only)
 */
router
  .route('/')
  .get(listRules, validate, getWorkOrders)
  .post(
    authorize(ROLES.ADMIN, ROLES.CUSTODIAN, ROLES.TECHNICIAN),
    [
      body('assetId').isInt(ID_OPTS).withMessage('A valid assetId is required').toInt(),
      body('type').optional().isIn(types),
      body('title').optional().isString().trim().isLength({ max: 200 }),
      body('description').optional().isString().trim().isLength({ max: 2000 }),
      body('priority').optional().isIn(priorities),
      body('technicianId').optional({ nullable: true }).isInt(ID_OPTS).toInt(),
      body('scheduledDate').optional({ nullable: true }).isISO8601(),
      body('intervalDays').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
      ...checklistRules,
    ],
    validate,
    createWorkOrder
  );

/**
 * @swagger
 * /api/work-orders/asset/{assetId}/summary:
 *   get:
 *     summary: Retrieve maintenance summary and historical statistics for a specific asset
 *     tags: [WorkOrders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assetId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the asset
 *     responses:
 *       200:
 *         description: Maintenance summary statistics retrieved successfully
 *       404:
 *         description: Asset not found
 */
router.get('/asset/:assetId/summary', idParam('assetId'), validate, getAssetMaintenanceSummary);

/**
 * @swagger
 * /api/work-orders/{id}/status:
 *   patch:
 *     summary: Update work order execution status, track downtime and maintenance costs
 *     description: State transitions follow OPEN -> IN_PROGRESS -> (ON_HOLD / COMPLETED / CANCELLED)
 *     tags: [WorkOrders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the work order
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [OPEN, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED]
 *                 example: IN_PROGRESS
 *               partsUsed:
 *                 type: string
 *                 example: Thermal Compound Paste Arctic MX-4
 *               partsCost:
 *                 type: number
 *                 example: 250.00
 *               downtimeHours:
 *                 type: number
 *                 example: 1.5
 *               completionNotes:
 *                 type: string
 *                 example: Maintenance initiated and inspection in progress.
 *     responses:
 *       200:
 *         description: Work order status updated successfully
 *       400:
 *         description: Invalid status value or disallowed transition
 *       403:
 *         description: Forbidden (Admin or Technician only)
 */
router.patch(
  '/:id/status',
  authorize(ROLES.ADMIN, ROLES.TECHNICIAN),
  [idParam(), body('status').isIn(statuses).withMessage(`status must be one of: ${statuses.join(', ')}`), ...costRules],
  validate,
  changeWorkOrderStatus
);

/**
 * @swagger
 * /api/work-orders/{id}:
 *   get:
 *     summary: Retrieve single work order details including checklist items
 *     tags: [WorkOrders]
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
 *         description: Work order details retrieved successfully
 *       404:
 *         description: Work order not found
 *   put:
 *     summary: Update work order details, assignments, or checklist items
 *     tags: [WorkOrders]
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
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *               technicianId:
 *                 type: integer
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *               partsCost:
 *                 type: number
 *               downtimeHours:
 *                 type: number
 *     responses:
 *       200:
 *         description: Work order updated successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden (Admin or Technician only)
 *   delete:
 *     summary: Delete a work order
 *     tags: [WorkOrders]
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
 *         description: Work order deleted successfully
 *       403:
 *         description: Forbidden (Admin only)
 */
router
  .route('/:id')
  .get(idParam(), validate, getWorkOrder)
  .put(
    authorize(ROLES.ADMIN, ROLES.TECHNICIAN),
    [
      idParam(),
      body('title').optional().isString().trim().isLength({ max: 200 }),
      body('description').optional().isString().trim().isLength({ max: 2000 }),
      body('priority').optional().isIn(priorities),
      body('technicianId').optional({ nullable: true }).isInt(ID_OPTS).toInt(),
      body('scheduledDate').optional({ nullable: true }).isISO8601(),
      body('intervalDays').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
      ...checklistRules,
      ...costRules,
    ],
    validate,
    updateWorkOrder
  )
  .delete(authorize(ROLES.ADMIN), idParam(), validate, deleteWorkOrder);

module.exports = router;