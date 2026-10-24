const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const QRCode = require('qrcode');

// GET /api/assets/:id/qr  -> PNG image
const getAssetQr = asyncHandler(async (req, res) => {
    const id = toId(req.params.id);
    const asset = await prisma.asset.findUnique({ where: { id }, select: { id: true, assetTag: true } });
    if (!asset) throw new ApiError(404, 'Asset not found');
    const payload = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/assets/${asset.id}?tag=${asset.assetTag}`;
    const png = await QRCode.toBuffer(payload, { type: 'png', width: 256, margin: 1 });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="asset-${asset.assetTag}.png"`);
    res.send(png);
});
const { logActivity } = require('../services/auditService');
const {
    assertAssignableLocation,
    assertActiveUser,
    categoryExists,
} = require('../utils/references');
const { ASSET_STATUS, ROLES } = require('../config/constants');
const {
    pick,
    toId,
    toDate,
    trimStr,
    parsePagination,
    paginationMeta,
    parseSort,
    toOrderBy,
    addDays,
} = require('../utils/helpers');
const { serializeAsset } = require('../utils/serializers');
const { assertValid, maxLen, tooLong } = require('../utils/validation');

const HAS_HISTORY_MESSAGE =
    'Cannot delete asset with custody or maintenance history. Retire the asset instead.';

const WRITABLE_FIELDS = [
    'assetTag',
    'serialNumber',
    'name',
    'brand',
    'model',
    'specifications',
    'categoryId',
    'condition',
    'procurement',
    'retirementReason',
    'disposalEvidence',
];

const PROCUREMENT_FIELDS = [
    'supplierName',
    'purchaseOrderNumber',
    'invoiceNumber',
    'purchaseCost',
    'purchaseDate',
    'warrantyExpiry',
    'warrantyTerms',
    'documentUrl',
];

const SORTABLE = [
    'createdAt',
    'name',
    'assetTag',
    'procurement.purchaseDate',
    'procurement.warrantyExpiry',
];
const SORT_COLUMNS = {
    'procurement.purchaseDate': 'purchaseDate',
    'procurement.warrantyExpiry': 'warrantyExpiry',
};

const INCLUDE = {
    category: {
        select: { id: true, name: true, expectedLifetimeMonths: true },
    },
    location: {
        select: {
            id: true,
            name: true,
            code: true,
            type: true,
            parentId: true,
        },
    },
    custodian: {
        select: {
            id: true,
            fullName: true,
            email: true,
            department: true,
            role: true,
        },
    },
};

const roundMoney = (v) =>
    v === null || v === undefined ? v : Math.round(v * 100) / 100;

const buildLifecycle = (asset) => {
    const months = asset.categoryId && asset.categoryId.expectedLifetimeMonths;
    const purchaseDate = asset.procurement && asset.procurement.purchaseDate;
    if (!months || !purchaseDate) return null;

    const now = new Date();
    const ageMonths = Math.max(
        0,
        (now.getFullYear() - purchaseDate.getFullYear()) * 12 +
            (now.getMonth() - purchaseDate.getMonth()),
    );
    const expectedEndOfLife = new Date(purchaseDate);
    expectedEndOfLife.setMonth(expectedEndOfLife.getMonth() + months);
    const warrantyExpiry = asset.procurement.warrantyExpiry;

    return {
        ageMonths,
        expectedLifetimeMonths: months,
        remainingMonths: months - ageMonths,
        expectedEndOfLife,
        isPastExpectedLife: now > expectedEndOfLife,
        warrantyActive: Boolean(warrantyExpiry && warrantyExpiry >= now),
    };
};

const toAssetData = (input) => {
    const data = {};
    [
        'assetTag',
        'serialNumber',
        'name',
        'brand',
        'model',
        'condition',
        'retirementReason',
        'disposalEvidence',
    ].forEach((key) => {
        if (input[key] !== undefined) data[key] = trimStr(input[key]);
    });
    if (data.assetTag) data.assetTag = data.assetTag.toUpperCase();
    if (input.specifications !== undefined)
        data.specifications = input.specifications;
    if (input.categoryId !== undefined)
        data.categoryId = toId(input.categoryId);

    if (input.procurement) {
        PROCUREMENT_FIELDS.forEach((key) => {
            const value = input.procurement[key];
            if (value === undefined) return;
            if (key === 'purchaseCost') data[key] = roundMoney(Number(value));
            else if (key === 'purchaseDate' || key === 'warrantyExpiry')
                data[key] = toDate(value);
            else data[key] = trimStr(value);
        });
    }
    return data;
};

const validateAssetData = (data, current = {}) => {
    const purchaseDate =
        data.purchaseDate !== undefined
            ? data.purchaseDate
            : current.purchaseDate;
    const warrantyExpiry =
        data.warrantyExpiry !== undefined
            ? data.warrantyExpiry
            : current.warrantyExpiry;
    assertValid([
        ['name', maxLen(data.name, 200), tooLong('name', 200)],
        [
            'procurement.purchaseCost',
            data.purchaseCost === undefined || data.purchaseCost >= 0,
            'Purchase cost cannot be negative',
        ],
        [
            'procurement.warrantyExpiry',
            !warrantyExpiry || !purchaseDate || warrantyExpiry >= purchaseDate,
            'Warranty expiry cannot be before the purchase date',
        ],
    ]);
};

// POST /api/assets
const createAsset = asyncHandler(async (req, res) => {
    const locationId = req.body.locationId ? toId(req.body.locationId) : null;
    const custodianId = req.body.custodianId
        ? toId(req.body.custodianId)
        : null;
    const { status } = req.body;

    if (!(await categoryExists(toId(req.body.categoryId))))
        throw new ApiError(404, 'Category not found');
    if (locationId) await assertAssignableLocation(locationId);
    if (custodianId) await assertActiveUser(custodianId, 'Custodian');

    const data = toAssetData(pick(req.body, WRITABLE_FIELDS));
    validateAssetData(data);
    data.locationId = locationId;
    data.custodianId = custodianId;
    data.status =
        status || (custodianId ? ASSET_STATUS.IN_USE : ASSET_STATUS.IN_STORAGE);

    const asset = await prisma.$transaction(async (tx) => {
        const created = await tx.asset.create({ data });

        if (locationId || custodianId) {
            await tx.custodyTransfer.create({
                data: {
                    assetId: created.id,
                    fromLocationId: null,
                    toLocationId: locationId,
                    fromCustodianId: null,
                    toCustodianId: custodianId,
                    transferredBy: req.user.id,
                    reason: 'Initial registration',
                },
            });
        }
        return created;
    });

    await logActivity({
        userId: req.user?.id || null,
        action: 'CREATE',
        entity: 'ASSET',
        entityId: asset.id,
        details: {
            assetTag: asset.assetTag,
            name: asset.name,
            locationId: asset.locationId,
            custodianId: asset.custodianId,
        },
        req,
    });

    res.status(201).json({ success: true, data: serializeAsset(asset) });
});

// GET /api/assets
const getAssets = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const q = req.query;
    const where = {};

    ['status', 'condition'].forEach((key) => {
        if (q[key]) where[key] = String(q[key]);
    });
    ['categoryId', 'custodianId'].forEach((key) => {
        if (q[key]) where[key] = toId(q[key]);
    });
    if (q.mine === 'true') where.custodianId = req.user.id;

    if (q.locationId) {
        where.locationId = toId(q.locationId);
    }

    const collegeIdParam = q.collegeId || q.facultyId;
    if (collegeIdParam) {
        const targetOrgId = toId(collegeIdParam);

        const subLocations = await prisma.location.findMany({
            where: {
                OR: [
                    { id: targetOrgId },
                    { parentId: targetOrgId },
                    { parent: { parentId: targetOrgId } },
                    { parent: { parent: { parentId: targetOrgId } } },
                ],
            },
            select: { id: true },
        });

        const allowedLocationIds = subLocations.map((loc) => loc.id);

        if (allowedLocationIds.length === 0) {
            return res.json({
                success: true,
                meta: paginationMeta(0, page, limit),
                data: [],
            });
        }

        if (where.locationId) {
            if (!allowedLocationIds.includes(where.locationId)) {
                return res.json({
                    success: true,
                    meta: paginationMeta(0, page, limit),
                    data: [],
                });
            }
        } else {
            where.locationId = { in: allowedLocationIds };
        }
    }

    if (q.q) {
        const contains = { contains: String(q.q), mode: 'insensitive' };
        where.OR = [
            { assetTag: contains },
            { serialNumber: contains },
            { name: contains },
            { brand: contains },
            { model: contains },
        ];
    }

    const days = parseInt(q.warrantyExpiringInDays, 10);
    if (!Number.isNaN(days) && days >= 0) {
        const now = new Date();
        where.warrantyExpiry = { gte: now, lte: addDays(now, days) };
    }

    const orderBy = toOrderBy(parseSort(q.sort, SORTABLE), SORT_COLUMNS);
    const [assets, total] = await Promise.all([
        prisma.asset.findMany({
            where,
            orderBy,
            skip,
            take: limit,
            include: INCLUDE,
        }),
        prisma.asset.count({ where }),
    ]);

    res.json({
        success: true,
        meta: paginationMeta(total, page, limit),
        data: assets.map(serializeAsset),
    });
});

// GET /api/assets/:id
const getAsset = asyncHandler(async (req, res) => {
    const asset = await prisma.asset.findUnique({
        where: { id: toId(req.params.id) },
        include: INCLUDE,
    });
    if (!asset) throw new ApiError(404, 'Asset not found');

    const data = serializeAsset(asset);
    res.json({
        success: true,
        data: { ...data, lifecycle: buildLifecycle(data) },
    });
});

// PUT /api/assets/:id
const updateAsset = asyncHandler(async (req, res) => {
    if (
        'locationId' in req.body ||
        'custodianId' in req.body ||
        'status' in req.body
    ) {
        throw new ApiError(
            400,
            'locationId/custodianId must be changed via POST /api/transfers, and status via PATCH /api/assets/:id/status',
        );
    }

    const id = toId(req.params.id);
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new ApiError(404, 'Asset not found');
    if (asset.status === ASSET_STATUS.RETIRED) {
        throw new ApiError(
            400,
            'Cannot update a retired asset (Read-only record)',
        );
    }

    const updates = pick(req.body, WRITABLE_FIELDS);
    if (
        updates.categoryId &&
        !(await categoryExists(toId(updates.categoryId)))
    ) {
        throw new ApiError(404, 'Category not found');
    }

    const data = toAssetData(updates);
    validateAssetData(data, asset);

    const saved = await prisma.asset.update({ where: { id }, data });

    await logActivity({
        userId: req.user?.id || null,
        action: 'UPDATE',
        entity: 'ASSET',
        entityId: saved.id,
        details: {
            assetTag: saved.assetTag,
            updatedFields: Object.keys(updates),
        },
        req,
    });

    res.json({ success: true, data: serializeAsset(saved) });
});

// PATCH /api/assets/:id/status
const updateAssetStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const id = toId(req.params.id);
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new ApiError(404, 'Asset not found');

    if (asset.status === ASSET_STATUS.RETIRED) {
        throw new ApiError(
            400,
            'Asset is retired and its status cannot be changed',
        );
    }
    if (status === ASSET_STATUS.UNDER_MAINTENANCE) {
        throw new ApiError(
            400,
            'UNDER_MAINTENANCE is set automatically when a work order is started',
        );
    }
    if (asset.status === ASSET_STATUS.UNDER_MAINTENANCE) {
        throw new ApiError(
            409,
            'Asset is under maintenance: complete or cancel its active work orders first',
        );
    }
    if (req.user.role === ROLES.CUSTODIAN) {
        if (!asset.custodianId || asset.custodianId !== req.user.id) {
            throw new ApiError(
                403,
                'You can only change the status of assets in your custody',
            );
        }
        if (status === ASSET_STATUS.RETIRED)
            throw new ApiError(
                403,
                'Only an ADMIN can retire an asset. Use PATCH /api/assets/:id/retire',
            );
    }

    const saved = await prisma.asset.update({
        where: { id },
        data: { status },
    });

    await logActivity({
        userId: req.user?.id || null,
        action: 'STATUS_CHANGE',
        entity: 'ASSET',
        entityId: saved.id,
        details: {
            assetTag: saved.assetTag,
            previousStatus: asset.status,
            newStatus: saved.status,
        },
        req,
    });

    res.json({ success: true, data: serializeAsset(saved) });
});

// PATCH /api/assets/:id/retire
const retireAsset = asyncHandler(async (req, res) => {
    const id = toId(req.params.id);
    const { retirementReason, disposalEvidence } = req.body;

    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new ApiError(404, 'Asset not found');

    if (asset.status === ASSET_STATUS.RETIRED) {
        throw new ApiError(400, 'Asset is already retired');
    }

    if (asset.status === ASSET_STATUS.UNDER_MAINTENANCE) {
        throw new ApiError(
            409,
            'Cannot retire an asset that is currently under maintenance',
        );
    }

    const updatedAsset = await prisma.asset.update({
        where: { id },
        data: {
            status: ASSET_STATUS.RETIRED,
            retiredAt: new Date(),
            retirementReason:
                trimStr(retirementReason) || 'End of lifecycle disposal',
            disposalEvidence: trimStr(disposalEvidence) || null,
        },
    });

    await logActivity({
        userId: req.user?.id || null,
        action: 'RETIRE',
        entity: 'ASSET',
        entityId: updatedAsset.id,
        details: {
            assetTag: updatedAsset.assetTag,
            retirementReason: updatedAsset.retirementReason,
            hasDisposalEvidence: Boolean(updatedAsset.disposalEvidence),
        },
        req,
    });

    res.json({
        success: true,
        message: 'Asset retired successfully',
        data: serializeAsset(updatedAsset),
    });
});

// DELETE /api/assets/:id
const deleteAsset = asyncHandler(async (req, res) => {
    const id = toId(req.params.id);
    const asset = await prisma.asset.findUnique({
        where: { id },
        select: { id: true, assetTag: true, name: true },
    });
    if (!asset) throw new ApiError(404, 'Asset not found');

    const [transfers, workOrders] = await Promise.all([
        prisma.custodyTransfer.count({ where: { assetId: id } }),
        prisma.workOrder.count({ where: { assetId: id } }),
    ]);
    if (transfers > 0 || workOrders > 0)
        throw new ApiError(409, HAS_HISTORY_MESSAGE);

    try {
        await prisma.asset.delete({ where: { id } });
    } catch (err) {
        if (err.code === 'P2003') throw new ApiError(409, HAS_HISTORY_MESSAGE);
        throw err;
    }

    await logActivity({
        userId: req.user?.id || null,
        action: 'DELETE',
        entity: 'ASSET',
        entityId: id,
        details: {
            assetTag: asset.assetTag,
            name: asset.name,
        },
        req,
    });

    res.json({ success: true, message: 'Asset deleted' });
});

// GET /api/assets/:id/risk-history
const getAssetRiskHistory = asyncHandler(async (req, res) => {
    const id = toId(req.params.id);
    const asset = await prisma.asset.findUnique({
        where: { id },
        select: { id: true },
    });
    if (!asset) throw new ApiError(404, 'Asset not found');

    const history = await prisma.riskHistory.findMany({
        where: { assetId: id },
        orderBy: { assessedAt: 'desc' },
    });

    res.json({ success: true, data: history });
});

// POST /api/assets/:id/assess-risk
const assessAssetRisk = asyncHandler(async (req, res) => {
    const id = toId(req.params.id);

    const asset = await prisma.asset.findUnique({
        where: { id },
        select: {
            id: true,
            assetTag: true,
            condition: true,
            status: true,
            purchaseDate: true,
            warrantyExpiry: true,
            category: { select: { id: true, expectedLifetimeMonths: true } },
            workOrders: {
                select: {
                    id: true,
                    type: true,
                    priority: true,
                    createdAt: true,
                    downtimeHours: true,
                    partsCost: true,
                },
            },
        },
    });

    if (!asset) throw new ApiError(404, 'Asset not found');

    const now = new Date();
    const purchaseDate = asset.purchaseDate
        ? new Date(asset.purchaseDate)
        : now;
    const assetAgeMonths = Math.max(
        0,
        (now.getFullYear() - purchaseDate.getFullYear()) * 12 +
            (now.getMonth() - purchaseDate.getMonth()),
    );

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const allWorkOrders = asset.workOrders || [];
    const recentWorkOrders = allWorkOrders.filter(
        (wo) => new Date(wo.createdAt) >= ninetyDaysAgo,
    );
    const previousWorkOrders = allWorkOrders.filter(
        (wo) => new Date(wo.createdAt) < ninetyDaysAgo,
    );

    const recentMaintenanceCount = recentWorkOrders.length;
    const downtimeHours90d = recentWorkOrders.reduce(
        (sum, wo) => sum + (wo.downtimeHours || 0),
        0,
    );
    const repairCost90d = recentWorkOrders.reduce(
        (sum, wo) => sum + Number(wo.partsCost || 0),
        0,
    );

    // --- Extended history features required by the AI prediction schema ---
    const isRepair = (wo) => wo.type === 'CORRECTIVE';
    const isFailure = (wo) =>
        wo.type === 'CORRECTIVE' &&
        (wo.priority === 'HIGH' || wo.priority === 'CRITICAL');
    const isPM = (wo) => wo.type === 'SCHEDULED';

    // Days since the last maintenance event (WO), falling back to purchase date
    const lastEventAt = allWorkOrders.reduce((latest, wo) => {
        const d = new Date(wo.createdAt);
        return !latest || d > latest ? d : latest;
    }, null);
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysSinceLastMaintenance = Math.max(
        0,
        Math.floor((now - (lastEventAt || purchaseDate)) / msPerDay),
    );

    const underWarranty = Boolean(
        asset.warrantyExpiry && new Date(asset.warrantyExpiry) >= now,
    );

    const aiPayload = {
        asset_id: String(asset.id),
        asset_age_months: assetAgeMonths,
        expected_lifetime_months: asset.category?.expectedLifetimeMonths || 60,
        condition: asset.condition,
        maintenance_count: allWorkOrders.length,
        recent_maintenance_count_90d: recentMaintenanceCount,
        downtime_hours_90d: downtimeHours90d,
        repair_cost_90d: repairCost90d,
        days_since_last_maintenance: daysSinceLastMaintenance,
        previous_repair_count: previousWorkOrders.filter(isRepair).length,
        recent_repair_count_90d: recentWorkOrders.filter(isRepair).length,
        previous_failure_count: previousWorkOrders.filter(isFailure).length,
        recent_failure_count_90d: recentWorkOrders.filter(isFailure).length,
        previous_pm_count: previousWorkOrders.filter(isPM).length,
        recent_pm_count_90d: recentWorkOrders.filter(isPM).length,
        under_warranty: underWarranty,
    };

    const prediction = await getAssetPrediction(aiPayload);

    const { updatedAsset, riskHistoryRecord } = await prisma.$transaction(
        async (tx) => {
            const updated = await tx.asset.update({
                where: { id },
                data: {
                    riskScore: prediction.risk_score,
                    riskLevel: prediction.risk_level,
                    failurePredicted: prediction.failure_predicted,
                },
                include: INCLUDE,
            });

            const history = await tx.riskHistory.create({
                data: {
                    assetId: id,
                    riskScore: prediction.risk_score,
                    riskLevel: prediction.risk_level,
                    failurePredicted: prediction.failure_predicted,
                    recommendations:
                        prediction.reasons && prediction.reasons.length > 0
                            ? prediction.reasons.join(', ')
                            : 'Normal assessment completed',
                    factors: {
                        ...aiPayload,
                        model_version: prediction.model_version,
                        failure_probability: prediction.failure_probability,
                    },
                },
            });

            return { updatedAsset: updated, riskHistoryRecord: history };
        },
    );

    await logActivity({
        userId: req.user?.id || null,
        action: 'RISK_ASSESSMENT',
        entity: 'ASSET',
        entityId: id,
        details: {
            assetTag: updatedAsset.assetTag,
            riskScore: prediction.risk_score,
            riskLevel: prediction.risk_level,
            failurePredicted: prediction.failure_predicted,
        },
        req,
    });

    res.status(200).json({
        success: true,
        message: 'Risk assessment completed successfully',
        data: {
            prediction,
            asset: serializeAsset(updatedAsset),
            riskHistory: riskHistoryRecord,
        },
    });
});

module.exports = {
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
};