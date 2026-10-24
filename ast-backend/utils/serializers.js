/**
 * Maps Prisma rows to the exact JSON shape the Mongoose API used to return:
 *  - primary key exposed as `_id`
 *  - foreign keys keep their old names (categoryId, locationId, ...) and become populated
 *    objects when the relation was included in the query (same as Mongoose populate)
 *  - Asset.procurement is re-nested as a sub-object
 *  - Decimal columns are returned as numbers
 * passwordHash is never serialized.
 */
const num = (v) => (v === null || v === undefined ? v : Number(v));

// Populated reference: { _id, ...selectedFields }
const ref = (obj) => {
  if (!obj) return null;
  const { id, ...rest } = obj;
  return { _id: id, ...rest };
};

// Populated object if the relation was included in the query, raw foreign key otherwise
const populatedOr = (row, relKey, fkKey) => (relKey in row ? ref(row[relKey]) : row[fkKey]);

const serializeUser = (u) => ({
  _id: u.id,
  fullName: u.fullName,
  email: u.email,
  role: u.role,
  department: u.department,
  isActive: u.isActive,
  passwordChangedAt: u.passwordChangedAt,
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
});

const serializeCategory = (c) => ({
  _id: c.id,
  name: c.name,
  description: c.description,
  expectedLifetimeMonths: c.expectedLifetimeMonths,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

const serializeLocation = (l) => ({
  _id: l.id,
  name: l.name,
  code: l.code,
  type: l.type,
  parentId: populatedOr(l, 'parent', 'parentId'),
  createdAt: l.createdAt,
  updatedAt: l.updatedAt,
});

const serializeAsset = (a) => ({
  _id: a.id,
  assetTag: a.assetTag,
  serialNumber: a.serialNumber,
  name: a.name,
  brand: a.brand,
  model: a.model,
  specifications: a.specifications,
  categoryId: populatedOr(a, 'category', 'categoryId'),
  locationId: populatedOr(a, 'location', 'locationId'),
  custodianId: populatedOr(a, 'custodian', 'custodianId'),
  condition: a.condition,
  status: a.status,
  procurement: {
    supplierName: a.supplierName,
    purchaseOrderNumber: a.purchaseOrderNumber,
    invoiceNumber: a.invoiceNumber,
    purchaseCost: num(a.purchaseCost),
    purchaseDate: a.purchaseDate,
    warrantyExpiry: a.warrantyExpiry,
    warrantyTerms: a.warrantyTerms,
    documentUrl: a.documentUrl,
  },
  createdAt: a.createdAt,
  updatedAt: a.updatedAt,
});

const serializeTransfer = (t) => ({
  _id: t.id,
  assetId: populatedOr(t, 'asset', 'assetId'),
  fromLocationId: populatedOr(t, 'fromLocation', 'fromLocationId'),
  toLocationId: populatedOr(t, 'toLocation', 'toLocationId'),
  fromCustodianId: populatedOr(t, 'fromCustodian', 'fromCustodianId'),
  toCustodianId: populatedOr(t, 'toCustodian', 'toCustodianId'),
  transferredBy: populatedOr(t, 'transferredByUser', 'transferredBy'),
  reason: t.reason,
  createdAt: t.createdAt,
});

const serializeWorkOrder = (w) => ({
  _id: w.id,
  assetId: populatedOr(w, 'asset', 'assetId'),
  technicianId: populatedOr(w, 'technician', 'technicianId'),
  createdBy: populatedOr(w, 'creator', 'createdBy'),
  type: w.type,
  title: w.title,
  description: w.description,
  priority: w.priority,
  status: w.status,
  checklist: w.checklist,
  partsUsed: w.partsUsed,
  partsCost: num(w.partsCost),
  downtimeHours: w.downtimeHours,
  completionNotes: w.completionNotes,
  scheduledDate: w.scheduledDate,
  intervalDays: w.intervalDays,
  nextDueDate: w.nextDueDate,
  startedAt: w.startedAt,
  completedAt: w.completedAt,
  previousAssetStatus: w.previousAssetStatus,
  createdAt: w.createdAt,
  updatedAt: w.updatedAt,
});

module.exports = {
  ref,
  serializeUser,
  serializeCategory,
  serializeLocation,
  serializeAsset,
  serializeTransfer,
  serializeWorkOrder,
};
