const express = require('express');
const { body, query } = require('express-validator');
const {
  createTransfer,
  getTransfers,
  getAssetHistory,
  getTransfer,
} = require('../controllers/transferController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate, idParam, ID_OPTS } = require('../middleware/validate');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect);

// Custody transfers are an append-only audit trail: no update, no delete
const rejectMutation = (req, res, next) =>
  next(new ApiError(405, 'Custody transfers are immutable: updates and deletes are not allowed'));

/**
 * @swagger
 * tags:
 *   name: Transfers
 *   description: Immutable custody and location transfer audit trail
 */

/**
 * @swagger
 * /api/transfers:
 *   get:
 *     summary: Retrieve custody transfer records with filters
 *     tags: [Transfers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: assetId
 *         schema:
 *           type: integer
 *         description: Filter by transferred asset ID
 *       - in: query
 *         name: locationId
 *         schema:
 *           type: integer
 *         description: Filter by target location ID
 *       - in: query
 *         name: custodianId
 *         schema:
 *           type: integer
 *         description: Filter by target custodian user ID
 *       - in: query
 *         name: transferredBy
 *         schema:
 *           type: integer
 *         description: Filter by user ID who executed the transfer
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter records created on or after this ISO date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter records created on or before this ISO date
 *     responses:
 *       200:
 *         description: List of transfer history records
 *       401:
 *         description: Unauthorized (Token required)
 *   post:
 *     summary: Transfer an asset to a new location and/or custodian
 *     description: Creates an immutable transfer log and updates current asset location/custodian. Requires either toLocationId, toCustodianId, or both.
 *     tags: [Transfers]
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
 *               - reason
 *             properties:
 *               assetId:
 *                 type: integer
 *                 example: 2
 *               toCustodianId:
 *                 type: integer
 *                 example: 3
 *                 description: Assign to custodian Ahmed (User ID 3)
 *               reason:
 *                 type: string
 *                 example: Reassigned custody to lab supervisor for semester maintenance
 *     responses:
 *       201:
 *         description: Asset custody transferred successfully
 *       400:
 *         description: Validation error or no change detected in custody/location
 *       403:
 *         description: Forbidden (Admin or Custodian only)
 */
router
  .route('/')
  .get(
    [
      query('assetId').optional().isInt(ID_OPTS).toInt(),
      query('locationId').optional().isInt(ID_OPTS).toInt(),
      query('custodianId').optional().isInt(ID_OPTS).toInt(),
      query('transferredBy').optional().isInt(ID_OPTS).toInt(),
      query('from').optional().isISO8601(),
      query('to').optional().isISO8601(),
    ],
    validate,
    getTransfers
  )
  .post(
    authorize(ROLES.ADMIN, ROLES.CUSTODIAN),
    [
      body('assetId').isInt(ID_OPTS).withMessage('A valid assetId is required').toInt(),
      body('toLocationId').optional({ nullable: true }).isInt(ID_OPTS).withMessage('Invalid toLocationId').toInt(),
      body('toCustodianId').optional({ nullable: true }).isInt(ID_OPTS).withMessage('Invalid toCustodianId').toInt(),
      body('reason').trim().notEmpty().withMessage('reason is required').isLength({ max: 1000 }),
      body().custom((value) => {
        if (!value.toLocationId && !value.toCustodianId) {
          throw new Error('Provide toLocationId and/or toCustodianId');
        }
        return true;
      }),
    ],
    validate,
    createTransfer
  )
  .put(rejectMutation)
  .patch(rejectMutation)
  .delete(rejectMutation);

/**
 * @swagger
 * /api/transfers/asset/{assetId}:
 *   get:
 *     summary: Get complete transfer and movement history for a specific asset
 *     tags: [Transfers]
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
 *         description: Transfer history retrieved successfully
 *       404:
 *         description: Asset not found
 */
router.get('/asset/:assetId', idParam('assetId'), validate, getAssetHistory);

/**
 * @swagger
 * /api/transfers/{id}:
 *   get:
 *     summary: Retrieve single transfer record by ID
 *     tags: [Transfers]
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
 *         description: Transfer record details
 *       404:
 *         description: Transfer record not found
 */
router
  .route('/:id')
  .get(idParam(), validate, getTransfer)
  .put(rejectMutation)
  .patch(rejectMutation)
  .delete(rejectMutation);

module.exports = router;