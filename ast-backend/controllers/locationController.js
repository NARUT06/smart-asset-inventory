const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const {
    LOCATION_PARENT_TYPE,
    ASSIGNABLE_LOCATION_TYPES,
} = require('../config/constants');
const {
    pick,
    toId,
    trimStr,
    parsePagination,
    paginationMeta,
} = require('../utils/helpers');
const { serializeLocation, ref } = require('../utils/serializers');
const { assertValid, maxLen, tooLong } = require('../utils/validation');
const { logActivity } = require('../services/auditService');

const PARENT_SELECT = {
    select: { id: true, name: true, code: true, type: true },
};

const validateLocationData = ({ name, code }) =>
    assertValid([
        [
            'name',
            name === undefined || (name && maxLen(name, 120)),
            'Location name is required and must be at most 120 characters',
        ],
        [
            'code',
            code === undefined || (code && maxLen(code, 40)),
            'Location code is required and must be at most 40 characters',
        ],
    ]);

// Enforces CAMPUS -> BUILDING -> FLOOR -> ROOM/OFFICE/LAB/STORAGE
const assertValidParent = async (type, parentId) => {
    const requiredParentType = LOCATION_PARENT_TYPE[type];

    if (requiredParentType === null) {
        if (parentId)
            throw new ApiError(
                400,
                `${type} is a root location and cannot have a parentId`,
            );
        return;
    }
    if (!parentId)
        throw new ApiError(
            400,
            `${type} requires a parentId of type ${requiredParentType}`,
        );

    const parent = await prisma.location.findUnique({
        where: { id: parentId },
        select: { type: true },
    });
    if (!parent) throw new ApiError(404, 'Parent location not found');
    if (parent.type !== requiredParentType) {
        throw new ApiError(
            400,
            `${type} must be placed under a ${requiredParentType} (got ${parent.type})`,
        );
    }
};

// POST /api/locations
const createLocation = asyncHandler(async (req, res) => {
    const { type } = req.body;
    const name = trimStr(req.body.name);
    const code = trimStr(req.body.code)?.toUpperCase();
    const parentId = req.body.parentId ? toId(req.body.parentId) : null;

    validateLocationData({ name, code });
    await assertValidParent(type, parentId);

    const location = await prisma.location.create({
        data: { name, code, type, parentId },
    });

    // تسجيل إضافة موقع جديد
    await logActivity({
        userId: req.user?.id || null,
        action: 'CREATE_LOCATION',
        entity: 'LOCATION',
        entityId: location.id,
        details: {
            name: location.name,
            code: location.code,
            type: location.type,
            parentId: location.parentId,
        },
        req,
    });

    res.status(201).json({ success: true, data: serializeLocation(location) });
});

// GET /api/locations?type=&parentId=&q=&page=&limit=
// parentId=null returns root locations
const getLocations = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, {
        defaultLimit: 50,
    });
    const where = {};
    if (req.query.type) where.type = String(req.query.type);
    if (req.query.parentId !== undefined) {
        where.parentId =
            String(req.query.parentId) === 'null'
                ? null
                : toId(req.query.parentId);
    }
    if (req.query.q) {
        const contains = { contains: String(req.query.q), mode: 'insensitive' };
        where.OR = [{ name: contains }, { code: contains }];
    }

    const [locations, total] = await Promise.all([
        prisma.location.findMany({
            where,
            orderBy: [{ name: 'asc' }, { id: 'asc' }],
            skip,
            take: limit,
            include: { parent: PARENT_SELECT },
        }),
        prisma.location.count({ where }),
    ]);
    res.json({
        success: true,
        meta: paginationMeta(total, page, limit),
        data: locations.map(serializeLocation),
    });
});

// GET /api/locations/tree?rootId=
// One query, tree assembled in memory (locations are a small, shallow hierarchy)
const getLocationTree = asyncHandler(async (req, res) => {
    const all = await prisma.location.findMany({
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        include: { _count: { select: { assets: true } } },
    });
    const nodes = new Map(
        all.map((l) => [l.id, { ...serializeLocation(l), children: [], assetCount: l._count?.assets ?? 0 }]),
    );
    const roots = [];

    for (const node of nodes.values()) {
        if (node.parentId !== null && nodes.has(node.parentId))
            nodes.get(node.parentId).children.push(node);
        else roots.push(node);
    }

    if (req.query.rootId) {
        const root = nodes.get(toId(req.query.rootId));
        if (!root) throw new ApiError(404, 'Location not found');
        return res.json({ success: true, data: [root] });
    }
    res.json({ success: true, data: roots });
});

// GET /api/locations/:id  (includes ancestors breadcrumb)
const getLocation = asyncHandler(async (req, res) => {
    const location = await prisma.location.findUnique({
        where: { id: toId(req.params.id) },
    });
    if (!location) throw new ApiError(404, 'Location not found');

    // Fetch all locations once and walk the ancestor chain in memory
    // (locations table is small; avoids N sequential findUnique calls)
    const allLocs = await prisma.location.findMany({
        select: { id: true, name: true, code: true, type: true, parentId: true },
    });
    const byId = new Map(allLocs.map((l) => [l.id, l]));
    const ancestors = [];
    let cur = location.parentId;
    let guard2 = 0;
    while (cur && guard2++ < 10) {
        const parent = byId.get(cur);
        if (!parent) break;
        ancestors.unshift(ref(parent));
        cur = parent.parentId;
    }

    res.json({
        success: true,
        data: { ...serializeLocation(location), ancestors },
    });
});

// GET /api/locations/:id/children
const getChildren = asyncHandler(async (req, res) => {
    const id = toId(req.params.id);
    const exists = await prisma.location.findUnique({
        where: { id },
        select: { id: true },
    });
    if (!exists) throw new ApiError(404, 'Location not found');
    const children = await prisma.location.findMany({
        where: { parentId: id },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    res.json({ success: true, data: children.map(serializeLocation) });
});

// PUT /api/locations/:id
const updateLocation = asyncHandler(async (req, res) => {
    const id = toId(req.params.id);
    const location = await prisma.location.findUnique({ where: { id } });
    if (!location) throw new ApiError(404, 'Location not found');

    const picked = pick(req.body, ['name', 'code', 'type', 'parentId']);
    const name = trimStr(picked.name);
    const code = trimStr(picked.code)?.toUpperCase();
    const { type } = picked;
    const parentId =
        picked.parentId === undefined
            ? undefined
            : picked.parentId === null
              ? null
              : toId(picked.parentId);

    const newType = type !== undefined ? type : location.type;
    const newParent = parentId !== undefined ? parentId : location.parentId;

    if (newType !== location.type) {
        if (
            (await prisma.location.count({
                where: { parentId: location.id },
            })) > 0
        ) {
            throw new ApiError(
                409,
                'Cannot change the type of a location that has children',
            );
        }
        if (
            !ASSIGNABLE_LOCATION_TYPES.includes(newType) &&
            (await prisma.asset.count({ where: { locationId: location.id } })) >
                0
        ) {
            throw new ApiError(
                409,
                'Cannot change the type: assets are stored in this location',
            );
        }
    }

    if (type !== undefined || parentId !== undefined) {
        if (newParent && newParent === location.id) {
            throw new ApiError(400, 'A location cannot be its own parent');
        }
        await assertValidParent(newType, newParent);
    }

    validateLocationData({ name, code });
    const saved = await prisma.location.update({
        where: { id },
        data: {
            ...(name !== undefined && { name }),
            ...(code !== undefined && { code }),
            type: newType,
            parentId: newParent || null,
        },
    });

    // تسجيل تحديث الموقع
    await logActivity({
        userId: req.user?.id || null,
        action: 'UPDATE_LOCATION',
        entity: 'LOCATION',
        entityId: saved.id,
        details: {
            name: saved.name,
            code: saved.code,
            type: saved.type,
            parentId: saved.parentId,
        },
        req,
    });

    res.json({ success: true, data: serializeLocation(saved) });
});

// DELETE /api/locations/:id
const deleteLocation = asyncHandler(async (req, res) => {
    const id = toId(req.params.id);
    const location = await prisma.location.findUnique({
        where: { id },
        select: { id: true, name: true, code: true },
    });
    if (!location) throw new ApiError(404, 'Location not found');

    if ((await prisma.location.count({ where: { parentId: id } })) > 0) {
        throw new ApiError(
            409,
            'Cannot delete a location that has child locations',
        );
    }
    if ((await prisma.asset.count({ where: { locationId: id } })) > 0) {
        throw new ApiError(
            409,
            'Cannot delete a location that still holds assets',
        );
    }
    if (
        (await prisma.custodyTransfer.count({
            where: { OR: [{ fromLocationId: id }, { toLocationId: id }] },
        })) > 0
    ) {
        throw new ApiError(
            409,
            'Cannot delete a location referenced by the custody audit trail',
        );
    }

    await prisma.location.delete({ where: { id } });

    // تسجيل حذف الموقع
    await logActivity({
        userId: req.user?.id || null,
        action: 'DELETE_LOCATION',
        entity: 'LOCATION',
        entityId: id,
        details: {
            name: location.name,
            code: location.code,
        },
        req,
    });

    res.json({ success: true, message: 'Location deleted' });
});

module.exports = {
    createLocation,
    getLocations,
    getLocationTree,
    getLocation,
    getChildren,
    updateLocation,
    deleteLocation,
};
