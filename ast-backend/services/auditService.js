const prisma = require('../config/prisma');

const logActivity = async ({
    userId = null,
    action,
    entity,
    entityId = null,
    details = {},
    req = null,
}) => {
    try {
        // 1. تنظيف واقتصاص الـ IP بما لا يتجاوز 45 حرفاً (قيود قاعدة البيانات)
        let rawIp = req
            ? req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || null
            : null;

        let ipAddress = null;
        if (typeof rawIp === 'string') {
            ipAddress = rawIp.split(',')[0].trim().slice(0, 45);
        }

        // 2. تحويل أي تواريخ أو كائنات معقدة داخل details إلى JSON آمن
        const safeDetails = JSON.parse(JSON.stringify(details || {}));

        // 3. اقتصاص الـ action والـ entity لأقل من 50 حرفاً ضماناً لعدم كسر القيد
        const safeAction = String(action).slice(0, 50);
        const safeEntity = String(entity).slice(0, 50);

        const record = await prisma.auditLog.create({
            data: {
                userId: userId ? Number(userId) : null,
                action: safeAction,
                entity: safeEntity,
                entityId: entityId ? Number(entityId) : null,
                details: safeDetails,
                ipAddress,
            },
        });

        return record;
    } catch (error) {
        console.error('❌ Detailed AuditLog Error:', {
            message: error.message,
            code: error.code,
            action,
            entity,
        });
    }
};

module.exports = { logActivity };