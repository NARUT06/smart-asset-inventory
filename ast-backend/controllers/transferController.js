const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { assertAssignableLocation, assertActiveUser } = require('../utils/references');
const { ASSET_STATUS, ROLES } = require('../config/constants');
const { toId, parsePagination, paginationMeta } = require('../utils/helpers');
const { serializeTransfer } = require('../utils/serializers');
const { logActivity } = require('../services/auditService');

// Equivalent of the old Mongoose populate()
const INCLUDE = {
  asset: { select: { id: true, assetTag: true, serialNumber: true, name: true } },
  fromLocation: { select: { id: true, name: true, code: true, type: true } },
  toLocation: { select: { id: true, name: true, code: true, type: true } },
  fromCustodian: { select: { id: true, fullName: true, email: true, role: true } },
  toCustodian: { select: { id: true, fullName: true, email: true, role: true } },
  transferredByUser: { select: { id: true, fullName: true, email: true, role: true } },
};

const sameId = (a, b) => (a ?? null) === (b ?? null);

// POST /api/transfers   (append-only)
const createTransfer = asyncHandler(async (req, res) => {
  const assetId = toId(req.body.assetId);
  const toLocationId = req.body.toLocationId ? toId(req.body.toLocationId) : null;
  const toCustodianId = req.body.toCustodianId ? toId(req.body.toCustodianId) : null;
  const { reason } = req.body;

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw new ApiError(404, 'Asset not found');
  if (asset.status === ASSET_STATUS.RETIRED) throw new ApiError(409, 'Retired assets cannot be transferred');

  if (req.user.role === ROLES.CUSTODIAN && asset.custodianId && !sameId(asset.custodianId, req.user.id)) {
    throw new ApiError(403, 'You can only transfer assets that are in your custody');
  }

  // Omitted destination fields keep their current value
  const newLocationId = toLocationId || asset.locationId;
  const newCustodianId = toCustodianId || asset.custodianId;
  const locationChanged = !sameId(newLocationId, asset.locationId);
  const custodianChanged = !sameId(newCustodianId, asset.custodianId);

  if (!locationChanged && !custodianChanged) {
    throw new ApiError(400, 'A transfer must change the location and/or the custodian');
  }
  if (locationChanged) await assertAssignableLocation(newLocationId);
  if (custodianChanged) await assertActiveUser(newCustodianId, 'Custodian');

  const fromLocationId = asset.locationId || null;
  const fromCustodianId = asset.custodianId || null;

  const transfer = await prisma.$transaction(async (tx) => {
    // Optimistic concurrency: only update if the asset still holds the values we read
    const result = await tx.asset.updateMany({
      where: { id: asset.id, locationId: fromLocationId, custodianId: fromCustodianId },
      data: { locationId: newLocationId || null, custodianId: newCustodianId || null },
    });
    if (result.count === 0) {
      throw new ApiError(409, 'The asset was modified by someone else. Reload it and try again');
    }

    return tx.custodyTransfer.create({
      data: {
        assetId: asset.id,
        fromLocationId,
        toLocationId: newLocationId || null,
        fromCustodianId,
        toCustodianId: newCustodianId || null,
        transferredBy: req.user.id,
        reason,
      },
      include: INCLUDE,
    });
  });

  // تسجيل عملية نقل العهدة
  await logActivity({
    userId: req.user?.id || null,
    action: 'CUSTODY_TRANSFER',
    entity: 'CUSTODY_TRANSFER',
    entityId: transfer.id,
    details: {
      assetId: asset.id,
      assetTag: asset.assetTag,
      fromLocationId,
      toLocationId: newLocationId || null,
      fromCustodianId,
      toCustodianId: newCustodianId || null,
      reason: reason || null,
    },
    req,
  });

  res.status(201).json({ success: true, data: serializeTransfer(transfer) });
});

// GET /api/transfers?assetId=&locationId=&custodianId=&transferredBy=&from=&to=
const getTransfers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const q = req.query;
  const where = {};

  if (q.assetId) where.assetId = toId(q.assetId);
  if (q.transferredBy) where.transferredBy = toId(q.transferredBy);

  const and = [];
  if (q.locationId) {
    const id = toId(q.locationId);
    and.push({ OR: [{ fromLocationId: id }, { toLocationId: id }] });
  }
  if (q.custodianId) {
    const id = toId(q.custodianId);
    and.push({ OR: [{ fromCustodianId: id }, { toCustodianId: id }] });
  }
  if (and.length) where.AND = and;

  if (q.from || q.to) {
    where.createdAt = {};
    if (q.from) where.createdAt.gte = new Date(String(q.from));
    if (q.to) where.createdAt.lte = new Date(String(q.to));
  }

  const [transfers, total] = await Promise.all([
    prisma.custodyTransfer.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: limit,
      include: INCLUDE,
    }),
    prisma.custodyTransfer.count({ where }),
  ]);
  res.json({
    success: true,
    meta: paginationMeta(total, page, limit),
    data: transfers.map(serializeTransfer),
  });
});

// GET /api/transfers/asset/:assetId  -> full custody history of one asset
const getAssetHistory = asyncHandler(async (req, res) => {
  const assetId = toId(req.params.assetId);
  const exists = await prisma.asset.findUnique({ where: { id: assetId }, select: { id: true } });
  if (!exists) throw new ApiError(404, 'Asset not found');

  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50 });
  const [history, total] = await Promise.all([
    prisma.custodyTransfer.findMany({
      where: { assetId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: limit,
      include: INCLUDE,
    }),
    prisma.custodyTransfer.count({ where: { assetId } }),
  ]);
  res.json({
    success: true,
    meta: paginationMeta(total, page, limit),
    count: history.length,
    data: history.map(serializeTransfer),
  });
});

// GET /api/transfers/:id
const getTransfer = asyncHandler(async (req, res) => {
  const transfer = await prisma.custodyTransfer.findUnique({
    where: { id: toId(req.params.id) },
    include: INCLUDE,
  });
  if (!transfer) throw new ApiError(404, 'Transfer not found');
  res.json({ success: true, data: serializeTransfer(transfer) });
});

module.exports = { createTransfer, getTransfers, getAssetHistory, getTransfer };