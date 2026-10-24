const { randomUUID } = require('crypto');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { assertActiveUser } = require('../utils/references');
const { logActivity } = require('../services/auditService');
const {
    ROLES,
    ASSET_STATUS,
    WORK_ORDER_TYPE,
    WORK_ORDER_STATUS,
    WORK_ORDER_ACTIVE_STATUSES,
    WORK_ORDER_TRANSITIONS,
} = require('../config/constants');
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
const { serializeWorkOrder, ref } = require('../utils/serializers');
const { assertValid, maxLen, tooLong } = require('../utils/validation');

const ADMIN_FIELDS = [
    'title',
    'description',
    'priority',
    'technicianId',
    'checklist',
    'scheduledDate',
    'intervalDays',
    'partsUsed',
    'partsCost',
    'downtimeHours',
    'completionNotes',
];
const TECHNICIAN_FIELDS = [
    'checklist',
    'partsUsed',
    'partsCost',
    'downtimeHours',
    'completionNotes',
];
const SORTABLE = ['createdAt', 'scheduledDate', 'status', 'completedAt'];

// Equivalent of the old Mongoose populate()
const INCLUDE = {
    asset: {
        select: {
            id: true,
            assetTag: true,
            serialNumber: true,
            name: true,
            status: true,
        },
    },
    technician: {
        select: { id: true, fullName: true, email: true, role: true },
    },
    creator: { select: { id: true, fullName: true, email: true, role: true } },
};

const isTerminal = (status) => WORK_ORDER_TRANSITIONS[status].length === 0;
const sameId = (a, b) => (a ?? null) === (b ?? null);

// Checklist items live in a JSON column: [{ _id, task, isDone, note? }]
const normalizeChecklist = (items) =>
    items.map((item) => ({
        _id: item._id || randomUUID(),
        task: trimStr(item.task),
        isDone: item.isDone === undefined ? false : Boolean(item.isDone),
        ...(item.note !== undefined && { note: trimStr(item.note) }),
    }));

// Request fields -> Prisma data (ids as ints, dates as Date, strings trimmed, checklist normalized)
const toWorkOrderData = (input) => {
    const data = { ...input };
    if (data.assetId !== undefined) data.assetId = toId(data.assetId);
    if (data.technicianId !== undefined && data.technicianId !== null)
        data.technicianId = toId(data.technicianId);
    if (data.scheduledDate !== undefined)
        data.scheduledDate = toDate(data.scheduledDate);
    if (data.checklist !== undefined)
        data.checklist = normalizeChecklist(data.checklist);
    ['title', 'description', 'partsUsed', 'completionNotes'].forEach((key) => {
        if (data[key] !== undefined) data[key] = trimStr(data[key]);
    });
    return data;
};

const validateWorkOrderData = (data) =>
    assertValid([
        ['title', maxLen(data.title, 200), tooLong('title', 200)],
        [
            'description',
            maxLen(data.description, 2000),
            tooLong('description', 2000),
        ],
        ['partsUsed', maxLen(data.partsUsed, 2000), tooLong('partsUsed', 2000)],
        [
            'completionNotes',
            maxLen(data.completionNotes, 2000),
            tooLong('completionNotes', 2000),
        ],
        [
            'partsCost',
            data.partsCost === undefined || data.partsCost >= 0,
            'Parts cost cannot be negative',
        ],
        [
            'downtimeHours',
            data.downtimeHours === undefined || data.downtimeHours >= 0,
            'Downtime cannot be negative',
        ],
        [
            'intervalDays',
            data.intervalDays === undefined ||
                data.intervalDays === null ||
                data.intervalDays >= 1,
            'intervalDays must be at least 1',
        ],
        ...(data.checklist || []).flatMap((item, i) => [
            [
                `checklist.${i}.task`,
                item.task && maxLen(item.task, 300),
                'Checklist task is required and must be at most 300 characters',
            ],
            [
                `checklist.${i}.note`,
                maxLen(item.note, 500),
                tooLong('note', 500),
            ],
        ]),
    ]);

// POST /api/work-orders
const createWorkOrder = asyncHandler(async (req, res) => {
    const assetId = toId(req.body.assetId);
    const technicianId = req.body.technicianId
        ? toId(req.body.technicianId)
        : null;
    const { type = WORK_ORDER_TYPE.CORRECTIVE } = req.body;

    const asset = await prisma.asset.findUnique({
        where: { id: assetId },
        select: { status: true },
    });
    if (!asset) throw new ApiError(404, 'Asset not found');
    if (asset.status === ASSET_STATUS.RETIRED) {
        throw new ApiError(
            409,
            'Cannot create work orders for a retired asset',
        );
    }
    if (
        type === WORK_ORDER_TYPE.SCHEDULED &&
        req.user.role === ROLES.CUSTODIAN
    ) {
        throw new ApiError(
            403,
            'Custodians can only report corrective work orders',
        );
    }
    if (technicianId) {
        if (req.user.role !== ROLES.ADMIN)
            throw new ApiError(403, 'Only an ADMIN can assign a technician');
        await assertActiveUser(technicianId, 'Technician', ROLES.TECHNICIAN);
    }

    const data = toWorkOrderData(
        pick(req.body, [
            'assetId',
            'type',
            'title',
            'description',
            'priority',
            'technicianId',
            'checklist',
            'scheduledDate',
            'intervalDays',
        ]),
    );
    validateWorkOrderData(data);

    const workOrder = await prisma.workOrder.create({
        data: { ...data, createdBy: req.user.id },
        include: INCLUDE,
    });

    await logActivity({
        userId: req.user?.id || null,
        action: 'CREATE_WORK_ORDER',
        entity: 'WORK_ORDER',
        entityId: workOrder.id,
        details: {
            assetId: workOrder.assetId,
            title: workOrder.title,
            priority: workOrder.priority,
            type: workOrder.type,
            technicianId: workOrder.technicianId,
        },
        req,
    });

    res.status(201).json({
        success: true,
        data: serializeWorkOrder(workOrder),
    });
});

// GET /api/work-orders?assetId=&technicianId=&status=&priority=&type=&overdue=true&dueBefore=
const getWorkOrders = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const q = req.query;
    const where = {};

    ['status', 'priority', 'type'].forEach((key) => {
        if (q[key]) where[key] = String(q[key]);
    });
    ['assetId', 'technicianId'].forEach((key) => {
        if (q[key]) where[key] = toId(q[key]);
    });

    // Technicians only see their own work orders and the unassigned ones
    if (req.user.role === ROLES.TECHNICIAN) {
        where.OR = [{ technicianId: req.user.id }, { technicianId: null }];
        if (q.technicianId) delete where.technicianId;
    }

    if (q.overdue === 'true') {
        where.scheduledDate = {
            ...(where.scheduledDate || {}),
            lt: new Date(),
        };
        if (!where.status)
            where.status = { in: [...WORK_ORDER_ACTIVE_STATUSES] };
    }
    if (q.dueBefore) {
        where.scheduledDate = {
            ...(where.scheduledDate || {}),
            lte: new Date(String(q.dueBefore)),
        };
        if (!where.status)
            where.status = { in: [...WORK_ORDER_ACTIVE_STATUSES] };
    }

    const orderBy = toOrderBy(parseSort(q.sort, SORTABLE));
    const [workOrders, total] = await Promise.all([
        prisma.workOrder.findMany({
            where,
            orderBy,
            skip,
            take: limit,
            include: INCLUDE,
        }),
        prisma.workOrder.count({ where }),
    ]);
    res.json({
        success: true,
        meta: paginationMeta(total, page, limit),
        data: workOrders.map(serializeWorkOrder),
    });
});

// GET /api/work-orders/:id
const getWorkOrder = asyncHandler(async (req, res) => {
    const workOrder = await prisma.workOrder.findUnique({
        where: { id: toId(req.params.id) },
        include: INCLUDE,
    });
    if (!workOrder) throw new ApiError(404, 'Work order not found');
    res.json({ success: true, data: serializeWorkOrder(workOrder) });
});

// GET /api/work-orders/asset/:assetId/summary  -> maintenance KPIs for one asset
const getAssetMaintenanceSummary = asyncHandler(async (req, res) => {
    const assetId = toId(req.params.assetId);
    const asset = await prisma.asset.findUnique({
        where: { id: assetId },
        select: { id: true },
    });
    if (!asset) throw new ApiError(404, 'Asset not found');

    const completed = { assetId, status: WORK_ORDER_STATUS.COMPLETED };

    // Replaces the Mongo $group pipeline: one aggregate + one filtered count + the next due order
    const [agg, correctiveCount, nextDue] = await Promise.all([
        prisma.workOrder.aggregate({
            where: completed,
            _count: { _all: true },
            _sum: { partsCost: true, downtimeHours: true },
            _avg: { downtimeHours: true },
            _max: { completedAt: true },
        }),
        prisma.workOrder.count({
            where: { ...completed, type: WORK_ORDER_TYPE.CORRECTIVE },
        }),
        prisma.workOrder.findFirst({
            where: {
                assetId,
                status: { in: [...WORK_ORDER_ACTIVE_STATUSES] },
                scheduledDate: { not: null },
            },
            orderBy: [{ scheduledDate: 'asc' }, { id: 'asc' }],
            select: {
                id: true,
                title: true,
                type: true,
                status: true,
                scheduledDate: true,
            },
        }),
    ]);

    const stats =
        agg._count._all > 0
            ? {
                  completedCount: agg._count._all,
                  correctiveCount,
                  totalPartsCost: Number(agg._sum.partsCost ?? 0),
                  totalDowntimeHours: agg._sum.downtimeHours ?? 0,
                  avgDowntimeHours: agg._avg.downtimeHours ?? 0,
                  lastCompletedAt: agg._max.completedAt,
              }
            : {};

    res.json({
        success: true,
        data: {
            completedCount: 0,
            correctiveCount: 0,
            totalPartsCost: 0,
            totalDowntimeHours: 0,
            avgDowntimeHours: 0,
            lastCompletedAt: null,
            ...stats,
            nextDue: ref(nextDue),
        },
    });
});

// PUT /api/work-orders/:id
const updateWorkOrder = asyncHandler(async (req, res) => {
    const id = toId(req.params.id);
    const workOrder = await prisma.workOrder.findUnique({ where: { id } });
    if (!workOrder) throw new ApiError(404, 'Work order not found');
    if (isTerminal(workOrder.status)) {
        throw new ApiError(
            409,
            `A ${workOrder.status} work order can no longer be edited`,
        );
    }

    const isAdmin = req.user.role === ROLES.ADMIN;
    if (!isAdmin && !sameId(workOrder.technicianId, req.user.id)) {
        throw new ApiError(
            403,
            'Only the assigned technician or an ADMIN can edit this work order',
        );
    }

    const updates = toWorkOrderData(
        pick(req.body, isAdmin ? ADMIN_FIELDS : TECHNICIAN_FIELDS),
    );
    if (updates.technicianId)
        await assertActiveUser(
            updates.technicianId,
            'Technician',
            ROLES.TECHNICIAN,
        );
    validateWorkOrderData(updates);

    const saved = await prisma.workOrder.update({
        where: { id },
        data: updates,
        include: INCLUDE,
    });

    await logActivity({
        userId: req.user?.id || null,
        action: 'UPDATE_WORK_ORDER',
        entity: 'WORK_ORDER',
        entityId: saved.id,
        details: {
            updatedFields: Object.keys(updates),
            technicianId: saved.technicianId,
        },
        req,
    });

    res.json({ success: true, data: serializeWorkOrder(saved) });
});

// PATCH /api/work-orders/:id/status
// Keeps the asset status in sync and generates the next scheduled work order on completion
const changeWorkOrderStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const id = toId(req.params.id);
    const workOrder = await prisma.workOrder.findUnique({ where: { id } });
    if (!workOrder) throw new ApiError(404, 'Work order not found');

    const isAdmin = req.user.role === ROLES.ADMIN;
    if (!isAdmin) {
        if (req.user.role !== ROLES.TECHNICIAN)
            throw new ApiError(403, 'Not allowed to change the status');
        if (
            workOrder.technicianId &&
            !sameId(workOrder.technicianId, req.user.id)
        ) {
            throw new ApiError(
                403,
                'This work order is assigned to another technician',
            );
        }
        if (status === WORK_ORDER_STATUS.CANCELLED) {
            throw new ApiError(403, 'Only an ADMIN can cancel a work order');
        }
    }

    if (!WORK_ORDER_TRANSITIONS[workOrder.status].includes(status)) {
        throw new ApiError(
            409,
            `Invalid transition ${workOrder.status} -> ${status}. Allowed: ${
                WORK_ORDER_TRANSITIONS[workOrder.status].join(', ') ||
                'none (terminal status)'
            }`,
        );
    }

    const data = toWorkOrderData(
        pick(req.body, [
            'completionNotes',
            'partsUsed',
            'partsCost',
            'downtimeHours',
        ]),
    );
    validateWorkOrderData(data);

    // Technician picking up an unassigned work order takes ownership of it
    if (!workOrder.technicianId && req.user.role === ROLES.TECHNICIAN) {
        data.technicianId = req.user.id;
    }

    const now = new Date();
    let nextDueDate = workOrder.nextDueDate;
    if (status === WORK_ORDER_STATUS.IN_PROGRESS && !workOrder.startedAt)
        data.startedAt = now;
    if (status === WORK_ORDER_STATUS.COMPLETED) {
        data.completedAt = now;
        if (workOrder.intervalDays) {
            nextDueDate = addDays(now, workOrder.intervalDays);
            data.nextDueDate = nextDueDate;
        }
    }

    const updated = await prisma.$transaction(async (tx) => {
        const asset = await tx.asset.findUnique({
            where: { id: workOrder.assetId },
        });
        if (!asset)
            throw new ApiError(
                404,
                'Asset of this work order no longer exists',
            );

        if (status === WORK_ORDER_STATUS.IN_PROGRESS) {
            if (asset.status === ASSET_STATUS.RETIRED) {
                throw new ApiError(409, 'Cannot start work on a retired asset');
            }
            if (asset.status !== ASSET_STATUS.UNDER_MAINTENANCE) {
                data.previousAssetStatus = asset.status;
                await tx.asset.update({
                    where: { id: asset.id },
                    data: { status: ASSET_STATUS.UNDER_MAINTENANCE },
                });
            }
        } else if (isTerminal(status)) {
            const otherActive = await tx.workOrder.count({
                where: {
                    assetId: asset.id,
                    id: { not: workOrder.id },
                    status: {
                        in: [
                            WORK_ORDER_STATUS.IN_PROGRESS,
                            WORK_ORDER_STATUS.ON_HOLD,
                        ],
                    },
                },
            });

            if (
                otherActive === 0 &&
                asset.status === ASSET_STATUS.UNDER_MAINTENANCE
            ) {
                await tx.asset.update({
                    where: { id: asset.id },
                    data: {
                        status:
                            workOrder.previousAssetStatus ||
                            ASSET_STATUS.IN_USE,
                    },
                });
            }
        }

        // Guard against two concurrent transitions (would double-schedule recurring orders)
        const result = await tx.workOrder.updateMany({
            where: { id: workOrder.id, status: workOrder.status },
            data: { ...data, status },
        });
        if (result.count === 0) {
            throw new ApiError(
                409,
                'The work order was modified by someone else. Reload it and try again',
            );
        }

        // Recurring maintenance: open the next scheduled work order automatically
        if (
            status === WORK_ORDER_STATUS.COMPLETED &&
            workOrder.type === WORK_ORDER_TYPE.SCHEDULED &&
            nextDueDate
        ) {
            await tx.workOrder.create({
                data: {
                    assetId: workOrder.assetId,
                    type: WORK_ORDER_TYPE.SCHEDULED,
                    title: workOrder.title,
                    description: workOrder.description,
                    priority: workOrder.priority,
                    technicianId: data.technicianId ?? workOrder.technicianId,
                    checklist: (workOrder.checklist || []).map((item) => ({
                        _id: randomUUID(),
                        task: item.task,
                        isDone: false,
                    })),
                    scheduledDate: nextDueDate,
                    intervalDays: workOrder.intervalDays,
                    createdBy: workOrder.createdBy,
                },
            });
        }

        return tx.workOrder.findUnique({
            where: { id: workOrder.id },
            include: INCLUDE,
        });
    });

    await logActivity({
        userId: req.user?.id || null,
        action: 'STATUS_CHANGE_WORK_ORDER',
        entity: 'WORK_ORDER',
        entityId: updated.id,
        details: {
            previousStatus: workOrder.status,
            newStatus: status,
            partsCost: data.partsCost,
            downtimeHours: data.downtimeHours,
        },
        req,
    });

    res.json({ success: true, data: serializeWorkOrder(updated) });
});

// DELETE /api/work-orders/:id   (ADMIN, only while still OPEN)
const deleteWorkOrder = asyncHandler(async (req, res) => {
    const id = toId(req.params.id);
    const workOrder = await prisma.workOrder.findUnique({
        where: { id },
        select: { id: true, title: true, status: true },
    });
    if (!workOrder) throw new ApiError(404, 'Work order not found');
    if (workOrder.status !== WORK_ORDER_STATUS.OPEN) {
        throw new ApiError(
            409,
            'Only OPEN work orders can be deleted. Cancel it instead',
        );
    }
    await prisma.workOrder.delete({ where: { id } });

    await logActivity({
        userId: req.user?.id || null,
        action: 'DELETE_WORK_ORDER',
        entity: 'WORK_ORDER',
        entityId: id,
        details: {
            title: workOrder.title,
        },
        req,
    });

    res.json({ success: true, message: 'Work order deleted' });
});

module.exports = {
    createWorkOrder,
    getWorkOrders,
    getWorkOrder,
    getAssetMaintenanceSummary,
    updateWorkOrder,
    changeWorkOrderStatus,
    deleteWorkOrder,
};
