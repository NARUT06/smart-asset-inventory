const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES } = require('../config/constants');

// @desc    Get role-scoped dashboard metrics
// @route   GET /api/dashboard/stats
// @access  Private
const getDashboardStats = asyncHandler(async (req, res) => {
    const user = req.user;
    let assetWhere = {};
    let workOrderWhere = {};

    // فلترة البيانات بناءً على دور المستخدم (Role-scoped)
    if (user.role === ROLES.CUSTODIAN) {
        assetWhere = { custodianId: user.id }; // يشوف عهدته بس
    } else if (user.role === ROLES.TECHNICIAN) {
        workOrderWhere = { technicianId: user.id }; // يشوف شغله بس
    }

    const [
        totalAssets,
        assetsInUse,
        assetsUnderMaintenance,
        assetsRetired,
        totalValuation,
        openWorkOrders,
        expiredWarranties,
    ] = await Promise.all([
        prisma.asset.count({ where: assetWhere }),
        prisma.asset.count({ where: { ...assetWhere, status: 'IN_USE' } }),
        prisma.asset.count({
            where: { ...assetWhere, status: 'UNDER_MAINTENANCE' },
        }),
        prisma.asset.count({ where: { ...assetWhere, status: 'RETIRED' } }),

        // حساب التكلفة يظهر فقط للإدارة والمشتريات
        user.role === ROLES.ADMIN || user.role === ROLES.PROCUREMENT
            ? prisma.asset.aggregate({
                  _sum: { purchaseCost: true },
                  where: assetWhere,
              })
            : { _sum: { purchaseCost: 0 } },

        prisma.workOrder.count({
            where: {
                ...workOrderWhere,
                status: { in: ['OPEN', 'IN_PROGRESS'] },
            },
        }),

        prisma.asset.count({
            where: {
                ...assetWhere,
                warrantyExpiry: { lt: new Date() },
                status: { not: 'RETIRED' },
            },
        }),
    ]);

    res.status(200).json({
        success: true,
        data: {
            counts: {
                total: totalAssets,
                inUse: assetsInUse,
                underMaintenance: assetsUnderMaintenance,
                retired: assetsRetired,
            },
            financials: {
                totalAssetValue: totalValuation._sum.purchaseCost || 0,
            },
            maintenance: {
                activeWorkOrders: openWorkOrders,
                warrantyExpiredCount: expiredWarranties,
            },
        },
    });
});

module.exports = { getDashboardStats };
