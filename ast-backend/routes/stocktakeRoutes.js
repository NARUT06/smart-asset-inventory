const express = require('express');
const { body } = require('express-validator');
const {
    createSession,
    getSessions,
    getSession,
    scanObservation,
    completeSession,
    deleteSession,
} = require('../controllers/stocktakeController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { validate, idParam, ID_OPTS } = require('../middleware/validate');
const { ROLES } = require('../config/constants');

const router = express.Router();
router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Stocktake
 *   description: Asset stocktake/audit sessions with QR scan and discrepancy review (AST-FR-07)
 */

router
    .route('/')
    .get(getSessions)
    .post(
        authorize(ROLES.ADMIN, ROLES.PROCUREMENT, ROLES.AUDITOR),
        [body('name').trim().notEmpty().withMessage('name is required'), body('scope').trim().notEmpty().withMessage('scope is required')],
        validate,
        createSession,
    );

router.get('/:id', idParam(), validate, getSession);

router.post(
    '/:id/scan',
    idParam(),
    [
        body('assetId').isInt(ID_OPTS).withMessage('A valid assetId is required').toInt(),
        body('observedLocationId').optional({ nullable: true }).isInt(ID_OPTS).toInt(),
        body('observedCondition').optional().isIn(['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED']),
    ],
    validate,
    scanObservation,
);

router.patch('/:id/complete', authorize(ROLES.ADMIN, ROLES.PROCUREMENT, ROLES.AUDITOR), idParam(), validate, completeSession);
router.delete('/:id', authorize(ROLES.ADMIN), idParam(), validate, deleteSession);

module.exports = router;
