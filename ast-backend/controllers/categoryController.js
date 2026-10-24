const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { pick, toId, trimStr, parsePagination, paginationMeta } = require('../utils/helpers');
const { serializeCategory } = require('../utils/serializers');
const { assertValid, maxLen, tooLong } = require('../utils/validation');
const { logActivity } = require('../services/auditService');

const FIELDS = ['name', 'description', 'expectedLifetimeMonths'];

const buildData = (body) => {
  const data = pick(body, FIELDS);
  data.name = trimStr(data.name);
  data.description = trimStr(data.description);
  assertValid([
    ['name', data.name === undefined || (data.name && maxLen(data.name, 120)), 'Category name is required and must be at most 120 characters'],
    ['description', maxLen(data.description, 500), tooLong('description', 500)],
    [
      'expectedLifetimeMonths',
      data.expectedLifetimeMonths === undefined || data.expectedLifetimeMonths >= 1,
      'Expected lifetime must be at least 1 month',
    ],
  ]);
  return data;
};

// POST /api/categories
const createCategory = asyncHandler(async (req, res) => {
  const category = await prisma.category.create({ data: buildData(req.body) });

  await logActivity({
    userId: req.user?.id || null,
    action: 'CREATE_CATEGORY',
    entity: 'CATEGORY',
    entityId: category.id,
    details: {
      name: category.name,
      expectedLifetimeMonths: category.expectedLifetimeMonths,
    },
    req,
  });

  res.status(201).json({ success: true, data: serializeCategory(category) });
});

// GET /api/categories
const getCategories = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50 });
  const where = {};
  if (req.query.q) where.name = { contains: String(req.query.q), mode: 'insensitive' };

  const [categories, total] = await Promise.all([
    prisma.category.findMany({ where, orderBy: [{ name: 'asc' }, { id: 'asc' }], skip, take: limit, include: { _count: { select: { assets: true } } } }),
    prisma.category.count({ where }),
  ]);
  res.json({
    success: true,
    meta: paginationMeta(total, page, limit),
    data: categories.map((c) => ({ ...serializeCategory(c), assetCount: c._count.assets })),
  });
});

// GET /api/categories/:id
const getCategory = asyncHandler(async (req, res) => {
  const category = await prisma.category.findUnique({ where: { id: toId(req.params.id) } });
  if (!category) throw new ApiError(404, 'Category not found');
  res.json({ success: true, data: serializeCategory(category) });
});

// PUT /api/categories/:id
const updateCategory = asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  const existing = await prisma.category.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!existing) throw new ApiError(404, 'Category not found');

  const category = await prisma.category.update({ where: { id }, data: buildData(req.body) });

  await logActivity({
    userId: req.user?.id || null,
    action: 'UPDATE_CATEGORY',
    entity: 'CATEGORY',
    entityId: category.id,
    details: {
      name: category.name,
      expectedLifetimeMonths: category.expectedLifetimeMonths,
    },
    req,
  });

  res.json({ success: true, data: serializeCategory(category) });
});

// DELETE /api/categories/:id
const deleteCategory = asyncHandler(async (req, res) => {
  const id = toId(req.params.id);
  const category = await prisma.category.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!category) throw new ApiError(404, 'Category not found');

  const inUse = await prisma.asset.count({ where: { categoryId: id } });
  if (inUse > 0) {
    throw new ApiError(409, `Cannot delete: ${inUse} asset(s) still use this category`);
  }
  await prisma.category.delete({ where: { id } });

  await logActivity({
    userId: req.user?.id || null,
    action: 'DELETE_CATEGORY',
    entity: 'CATEGORY',
    entityId: id,
    details: {
      name: category.name,
    },
    req,
  });

  res.json({ success: true, message: 'Category deleted' });
});

module.exports = { createCategory, getCategories, getCategory, updateCategory, deleteCategory };