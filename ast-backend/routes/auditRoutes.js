const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/auditController');
const { protect, authorize } = require('../middleware/authMiddleware');

// حصر الوصول لمدير النظام فقط
router.get('/', protect, authorize('ADMIN'), getAuditLogs);

module.exports = router;
