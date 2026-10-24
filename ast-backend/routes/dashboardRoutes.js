const express = require('express');
const { getDashboardStats } = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// حماية المسار عشان نضمن إن مفيش حد يدخل من غير ما يعمل Login
router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Operational metrics, aggregate system statistics, and asset summary analytics
 */

/**
 * @swagger
 * /api/dashboard/stats:
 *   get:
 *     summary: Retrieve aggregate dashboard metrics and statistics
 *     description: Provides operational overview counts including total assets by status/condition, open work orders, locations breakdown, and pending actions.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalAssets:
 *                       type: integer
 *                       example: 125
 *                     activeWorkOrders:
 *                       type: integer
 *                       example: 8
 *                     totalLocations:
 *                       type: integer
 *                       example: 24
 *                     recentTransfersCount:
 *                       type: integer
 *                       example: 15
 *       401:
 *         description: Unauthorized (Token required)
 */
router.get('/stats', getDashboardStats);

module.exports = router;