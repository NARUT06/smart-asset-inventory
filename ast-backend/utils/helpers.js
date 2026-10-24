const pick = (obj, keys) =>
  keys.reduce((acc, key) => {
    if (obj && obj[key] !== undefined) acc[key] = obj[key];
    return acc;
  }, {});

// "12" | 12 -> 12, anything else -> null
const toId = (value) => {
  const n = Number.parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
};

const toDate = (value) => (value === null || value === undefined ? value : new Date(value));

const parsePagination = (query, { defaultLimit = 20, maxLimit = 100 } = {}) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);
  return { page, limit, skip: (page - 1) * limit };
};

const paginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  pages: Math.ceil(total / limit) || 1,
});

// Allow-list based sort parsing, e.g. "-createdAt"
const parseSort = (raw, allowed, fallback = '-createdAt') => {
  const value = String(raw || fallback);
  return allowed.includes(value.replace(/^-/, '')) ? value : fallback;
};

// "-createdAt" -> [{ createdAt: 'desc' }, { id: 'desc' }]  (id = stable tie-breaker for pagination)
// fieldMap translates public sort keys to column names, e.g. { 'procurement.purchaseDate': 'purchaseDate' }
const toOrderBy = (sort, fieldMap = {}) => {
  const dir = sort.startsWith('-') ? 'desc' : 'asc';
  const key = sort.replace(/^-/, '');
  const field = fieldMap[key] || key;
  return field === 'id' ? [{ id: dir }] : [{ [field]: dir }, { id: dir }];
};

const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const trimStr = (value) => (typeof value === 'string' ? value.trim() : value);

module.exports = {
  pick,
  toId,
  toDate,
  parsePagination,
  paginationMeta,
  parseSort,
  toOrderBy,
  addDays,
  trimStr,
};
