const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES } = require('../config/constants');
const { toId, parsePagination, paginationMeta } = require('../utils/helpers');
const { logActivity } = require('../services/auditService');

// POST /api/stocktake  (ADMIN/PROCUREMENT/AUDITOR)
const createSession = asyncHandler(async (req, res) => {
    const { name, scope } = req.body;
    if (!name) throw new ApiError(400, 'name is required');
    if (!scope) throw new ApiError(400, 'scope is required');
    const session = await prisma.stocktakeSession.create({
        data: { name, scope: scope || null, createdBy: req.user.id },
    });
    await logActivity({ userId: req.user.id, action: 'CREATE', entity: 'STOCKTAKE', entityId: session.id, details: { name, scope }, req });
    res.status(201).json({ success: true, data: session });
});

// GET /api/stocktake
const getSessions = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20 });
    const where = {};
    if (req.query.status) where.status = String(req.query.status);
    const [sessions, total] = await Promise.all([
        prisma.stocktakeSession.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            include: { creator: { select: { id: true, fullName: true, email: true } }, _count: { select: { observations: true } } },
        }),
        prisma.stocktakeSession.count({ where }),
    ]);
    res.json({ success: true, meta: paginationMeta(total, page, limit), data: sessions });
});

// GET /api/stocktake/:id
const getSession = asyncHandler(async (req, res) => {
    const id = toId(req.params.id);
    const session = await prisma.stocktakeSession.findUnique({
        where: { id },
        include: {
            creator: { select: { id: true, fullName: true, email: true } },
            observations: {
                orderBy: { scannedAt: 'desc' },
                include: {
                    asset: { select: { id: true, assetTag: true, name: true, condition: true } },
                    expectedLocation: { select: { id: true, name: true, code: true } },
                    observedLocation: { select: { id: true, name: true, code: true } },
                    scanner: { select: { id: true, fullName: true } },
                },
            },
        },
    });
    if (!session) throw new ApiError(404, 'Stocktake session not found');
    res.json({ success: true, data: session });
});

// POST /api/stocktake/:id/scan  — record one observation
const scanObservation = asyncHandler(async (req, res) => {
    const sessionId = toId(req.params.id);
    const session = await prisma.stocktakeSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new ApiError(404, 'Stocktake session not found');
    if (session.status !== 'OPEN') throw new ApiError(400, 'Session is not open');

    const { assetId, observedLocationId, observedCondition } = req.body;
    const asset = await prisma.asset.findUnique({
        where: { id: toId(assetId) },
        select: { id: true, assetTag: true, condition: true, locationId: true, location: { select: { id: true, name: true } } },
    });
    if (!asset) throw new ApiError(404, 'Asset not found');

    const expectedLocationId = asset.locationId;
    const expectedCondition = asset.condition;
    const obsLocId = observedLocationId ? toId(observedLocationId) : null;

    let result = 'VERIFIED';
    if (expectedLocationId && obsLocId && expectedLocationId !== obsLocId) result = 'MOVED';
    if (expectedCondition && observedCondition && expectedCondition !== observedCondition) result = (result === 'MOVED' ? 'MOVED' : 'VERIFIED');
    // MISSING is set when asset scanned but not found in expected location — handled by client

    const observation = await prisma.observation.create({
        data: {
            sessionId,
            assetId: asset.id,
            expectedLocationId,
            observedLocationId: obsLocId,
            expectedCondition,
            observedCondition: observedCondition || null,
            result,
            scannedBy: req.user.id,
        },
        include: {
            asset: { select: { id: true, assetTag: true, name: true, condition: true } },
            expectedLocation: { select: { id: true, name: true, code: true } },
            observedLocation: { select: { id: true, name: true, code: true } },
        },
    });
    res.status(201).json({ success: true, data: observation });
});

// POST /api/stocktake/:id/complete  (ADMIN/PROCUREMENT/AUDITOR)
const completeSession = asyncHandler(async (req, res) => {
    const id = toId(req.params.id);
    const session = await prisma.stocktakeSession.findUnique({ where: { id } });
    if (!session) throw new ApiError(404, 'Stocktake session not found');
    if (session.status !== 'OPEN') throw new ApiError(400, 'Session is not open');
    const updated = await prisma.stocktakeSession.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date() },
    });
    await logActivity({ userId: req.user.id, action: 'UPDATE', entity: 'STOCKTAKE', entityId: id, details: { status: 'COMPLETED' }, req });
    res.json({ success: true, data: updated });
});

// DELETE /api/stocktake/:id  (ADMIN)
const deleteSession = asyncHandler(async (req, res) => {
    const id = toId(req.params.id);
    const session = await prisma.stocktakeSession.findUnique({ where: { id } });
    if (!session) throw new ApiError(404, 'Stocktake session not found');
    await prisma.stocktakeSession.delete({ where: { id } });
    await logActivity({ userId: req.user.id, action: 'DELETE', entity: 'STOCKTAKE', entityId: id, details: {}, req });
    res.json({ success: true, message: 'Session deleted' });
});

module.exports = {
    createSession,
    getSessions,
    getSession,
    scanObservation,
    completeSession,
    deleteSession,
};
