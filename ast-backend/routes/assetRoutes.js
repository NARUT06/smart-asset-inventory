const express = require('express');
const { body, query } = require('express-validator');
const {
    createAsset,
    getAssets,
    getAsset,
    getAssetQr,
    updateAsset,
    updateAssetStatus,
    retireAsset,
    deleteAsset,
    getAssetRiskHistory,
    assessAssetRisk,
} = require('../controllers/assetController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate, idParam, ID_OPTS } = require('../middleware/validate');
const { ROLES, ASSET_STATUS, ASSET_CONDITION } = require('../config/constants');

const router = express.Router();
router.use(protect);

const statuses = Object.values(ASSET_STATUS);
const conditions = Object.values(ASSET_CONDITION);

const listRules = [
    query('status').optional().isIn(statuses),
    query('condition').optional().isIn(conditions),
    query('categoryId').optional().isInt(ID_OPTS).toInt(),
    query('locationId').optional().isInt(ID_OPTS).toInt(),
    query('custodianId').optional().isInt(ID_OPTS).toInt(),
    query('collegeId').optional().isInt(ID_OPTS).toInt(),
    query('buildingId').optional().isInt(ID_OPTS).toInt(),
    query('collegeId').optional().isInt(ID_OPTS).toInt(),
    query('warrantyExpiringInDays').optional().isInt({ min: 0 }),
];

const createRules = [
    body('assetTag').trim().notEmpty().withMessage('assetTag is required'),
    body('serialNumber')
        .trim()
        .notEmpty()
        .withMessage('serialNumber is required'),
    body('name').trim().notEmpty().withMessage('name is required'),
    body('brand').optional().isString().trim(),
    body('model').optional().isString().trim(),
    body('specifications')
        .optional()
        .isObject()
        .withMessage('specifications must be an object'),
    body('categoryId')
        .isInt(ID_OPTS)
        .withMessage('A valid categoryId is required')
        .toInt(),
    body('locationId')
        .optional({ nullable: true })
        .isInt(ID_OPTS)
        .withMessage('Invalid locationId')
        .toInt(),
    body('custodianId')
        .optional({ nullable: true })
        .isInt(ID_OPTS)
        .withMessage('Invalid custodianId')
        .toInt(),
    body('condition').optional().isIn(conditions),
    body('status')
        .optional()
        .isIn([ASSET_STATUS.IN_USE, ASSET_STATUS.IN_STORAGE])
        .withMessage('A new asset can only be IN_USE or IN_STORAGE'),
    body('procurement').isObject().withMessage('procurement is required'),
    body('procurement.supplierName')
        .trim()
        .notEmpty()
        .withMessage('procurement.supplierName is required'),
    body('procurement.purchaseOrderNumber').optional().isString().trim(),
    body('procurement.invoiceNumber').optional().isString().trim(),
    body('procurement.purchaseCost')
        .isFloat({ min: 0 })
        .withMessage('procurement.purchaseCost must be >= 0')
        .toFloat(),
    body('procurement.purchaseDate')
        .isISO8601()
        .withMessage('procurement.purchaseDate must be a valid date'),
    body('procurement.warrantyExpiry').optional({ nullable: true }).isISO8601(),
    body('procurement.warrantyTerms').optional().isString().trim(),
    body('procurement.documentUrl')
        .optional({ nullable: true })
        .isURL()
        .withMessage('procurement.documentUrl must be a URL'),
];

const updateRules = [
    idParam(),
    body('assetTag').optional().trim().notEmpty(),
    body('serialNumber').optional().trim().notEmpty(),
    body('name').optional().trim().notEmpty(),
    body('brand').optional().isString().trim(),
    body('model').optional().isString().trim(),
    body('specifications').optional().isObject(),
    body('categoryId').optional().isInt(ID_OPTS).toInt(),
    body('condition').optional().isIn(conditions),
    body('procurement').optional().isObject(),
    body('procurement.supplierName').optional().trim().notEmpty(),
    body('procurement.purchaseOrderNumber').optional().isString().trim(),
    body('procurement.invoiceNumber').optional().isString().trim(),
    body('procurement.purchaseCost').optional().isFloat({ min: 0 }).toFloat(),
    body('procurement.purchaseDate').optional().isISO8601(),
    body('procurement.warrantyExpiry').optional({ nullable: true }).isISO8601(),
    body('procurement.warrantyTerms').optional().isString().trim(),
    body('procurement.documentUrl').optional({ nullable: true }).isURL(),
];

const retireRules = [
    idParam(),
    body('retirementReason').optional().isString().trim(),
    body('disposalEvidence').optional({ nullable: true }).isString().trim(),
];

/**
 * @swagger
 * tags:
 *   name: Assets
 *   description: Asset lifecycle management and controlled disposal operations
 */

/**
 * @swagger
 * /api/assets:
 *   get:
 *     summary: Retrieve asset inventory with advanced filtering
 *     tags: [Assets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [IN_USE, IN_STORAGE, UNDER_MAINTENANCE, RETIRED]
 *       - in: query
 *         name: condition
 *         schema:
 *           type: string
 *           enum: [NEW, GOOD, FAIR, POOR, DAMAGED]
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: locationId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: custodianId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: warrantyExpiringInDays
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of assets retrieved successfully
 *       401:
 *         description: Unauthorized (Token required)
 *   post:
 *     summary: Register a new asset with procurement and warranty details
 *     description: Assets can only be assigned to locations of type ROOM, OFFICE, LAB, or STORAGE (cannot be assigned directly to CAMPUS or BUILDING).
 *     tags: [Assets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - assetTag
 *               - serialNumber
 *               - name
 *               - categoryId
 *               - procurement
 *             properties:
 *               assetTag:
 *                 type: string
 *                 example: AST-2026-009
 *               serialNumber:
 *                 type: string
 *                 example: SN99887766
 *               name:
 *                 type: string
 *                 example: Dell Precision 7740
 *               brand:
 *                 type: string
 *                 example: Dell
 *               model:
 *                 type: string
 *                 example: 7740 Workstation
 *               specifications:
 *                 type: object
 *                 example: {"ram": "32GB", "processor": "Intel i9"}
 *               categoryId:
 *                 type: integer
 *                 example: 1
 *               locationId:
 *                 type: integer
 *                 description: Must refer to a location of type ROOM, OFFICE, LAB, or STORAGE
 *                 example: 4
 *               custodianId:
 *                 type: integer
 *                 example: 1
 *               condition:
 *                 type: string
 *                 example: NEW
 *               status:
 *                 type: string
 *                 example: IN_USE
 *               procurement:
 *                 type: object
 *                 required:
 *                   - supplierName
 *                   - purchaseCost
 *                   - purchaseDate
 *                 properties:
 *                   supplierName:
 *                     type: string
 *                     example: Delta Tech
 *                   purchaseOrderNumber:
 *                     type: string
 *                     example: PO-8871
 *                   invoiceNumber:
 *                     type: string
 *                     example: INV-2026-99
 *                   purchaseCost:
 *                     type: number
 *                     example: 45000.00
 *                   purchaseDate:
 *                     type: string
 *                     format: date-time
 *                     example: 2026-03-15T00:00:00.000Z
 *                   warrantyExpiry:
 *                     type: string
 *                     format: date-time
 *                     example: 2029-03-15T00:00:00.000Z
 *                   warrantyTerms:
 *                     type: string
 *                     example: 3 Years Onsite Next Business Day
 *                   documentUrl:
 *                     type: string
 *                     example: https://example.com/invoice.pdf
 *     responses:
 *       201:
 *         description: Asset registered successfully
 *       400:
 *         description: Validation error or invalid location type
 *       403:
 *         description: Forbidden (Admin or Procurement role required)
 */
router
    .route('/')
    .get(listRules, validate, getAssets)
    .post(
        authorize(ROLES.ADMIN, ROLES.PROCUREMENT),
        createRules,
        validate,
        createAsset,
    );

/**
 * @swagger
 * /api/assets/{id}/risk-history:
 *   get:
 *     summary: Get AI risk assessment timeline for an asset
 *     tags: [Assets]
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
 *         description: Historical risk data retrieved successfully
 *       404:
 *         description: Asset not found
 */
router.get('/:id/risk-history', idParam(), validate, getAssetRiskHistory);

// QR code label (PNG) for the asset
router.get('/:id/qr', idParam(), validate, getAssetQr);

/**
 * @swagger
 * /api/assets/{id}/assess-risk:
 *   post:
 *     summary: Trigger an AI predictive maintenance risk assessment
 *     tags: [Assets]
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
 *         description: Risk assessed and logged successfully
 *       404:
 *         description: Asset not found
 */
router.post('/:id/assess-risk', idParam(), validate, assessAssetRisk);

/**
 * @swagger
 * /api/assets/{id}/status:
 *   patch:
 *     summary: Update asset operational status (e.g., IN_USE, IN_STORAGE)
 *     tags: [Assets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
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
 *                 enum: [IN_USE, IN_STORAGE, UNDER_MAINTENANCE, RETIRED]
 *     responses:
 *       200:
 *         description: Asset status updated successfully
 *       400:
 *         description: Invalid status transition
 */
router.patch(
    '/:id/status',
    authorize(ROLES.ADMIN, ROLES.CUSTODIAN),
    [
        idParam(),
        body('status')
            .isIn(statuses)
            .withMessage(`status must be one of: ${statuses.join(', ')}`),
    ],
    validate,
    updateAssetStatus,
);

/**
 * @swagger
 * /api/assets/{id}/retire:
 *   patch:
 *     summary: Formally retire and dispose of an asset (Read-Only transition) (AST-FR-10)
 *     tags: [Assets]
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
 *               retirementReason:
 *                 type: string
 *                 example: Outdated hardware, motherboard damaged
 *               disposalEvidence:
 *                 type: string
 *                 example: Disposal form #882 approved by committee
 *     responses:
 *       200:
 *         description: Asset retired successfully
 *       400:
 *         description: Asset already retired or invalid state
 *       403:
 *         description: Forbidden (Admin only)
 */
router.patch(
    '/:id/retire',
    authorize(ROLES.ADMIN),
    retireRules,
    validate,
    retireAsset,
);

/**
 * @swagger
 * /api/assets/{id}:
 *   get:
 *     summary: Retrieve asset details and full lifecycle history
 *     tags: [Assets]
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
 *         description: Asset details retrieved successfully
 *       404:
 *         description: Asset not found
 *   put:
 *     summary: Update existing asset specifications and metadata
 *     tags: [Assets]
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
 *               brand:
 *                 type: string
 *               model:
 *                 type: string
 *               condition:
 *                 type: string
 *                 enum: [NEW, GOOD, FAIR, POOR, DAMAGED]
 *     responses:
 *       200:
 *         description: Asset updated successfully
 *       400:
 *         description: Cannot modify a retired asset
 *   delete:
 *     summary: Permanently delete an asset record
 *     tags: [Assets]
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
 *         description: Asset deleted successfully
 *       400:
 *         description: Cannot delete asset with related work orders or transfers
 */
router
    .route('/:id')
    .get(idParam(), validate, getAsset)
    .put(
        authorize(ROLES.ADMIN, ROLES.PROCUREMENT),
        updateRules,
        validate,
        updateAsset,
    )
    .delete(authorize(ROLES.ADMIN), idParam(), validate, deleteAsset);

module.exports = router;
