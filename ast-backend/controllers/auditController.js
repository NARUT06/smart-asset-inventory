const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const getAuditLogs = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;

        const { action, entity, userId } = req.query;

        const where = {};
        if (action) where.action = String(action);
        if (entity) where.entity = String(entity);
        if (userId) where.userId = Number(userId);

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    action: true,
                    entity: true,
                    entityId: true,
                    details: true,
                    ipAddress: true,
                    createdAt: true,
                    user: {
                        select: { id: true, fullName: true, email: true, role: true },
                    },
                },
            }),
            prisma.auditLog.count({ where }),
        ]);

        return res.json({
            success: true,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
            data: logs,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { getAuditLogs };