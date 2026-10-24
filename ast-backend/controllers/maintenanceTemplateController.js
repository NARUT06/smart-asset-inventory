const prisma = require('../config/prisma');

// @desc    Get all maintenance templates
// @route   GET /api/maintenance-templates
// @access  Private
const getTemplates = async (req, res, next) => {
    try {
        const templates = await prisma.maintenanceTemplate.findMany({
            include: {
                category: {
                    select: { id: true, name: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.status(200).json({
            success: true,
            count: templates.length,
            data: templates,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a new maintenance template
// @route   POST /api/maintenance-templates
// @access  Private (Admin / Procurement)
const createTemplate = async (req, res, next) => {
    try {
        const {
            title,
            description,
            triggerType,
            intervalDays,
            checklist,
            categoryId,
        } = req.body;

        const template = await prisma.maintenanceTemplate.create({
            data: {
                title,
                description,
                triggerType: triggerType || 'CALENDAR',
                intervalDays: Number(intervalDays),
                checklist: checklist || [],
                categoryId: Number(categoryId),
            },
        });

        res.status(201).json({
            success: true,
            data: template,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getTemplates,
    createTemplate,
};
