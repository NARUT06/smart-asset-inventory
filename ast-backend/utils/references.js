const prisma = require('../config/prisma');
const ApiError = require('./ApiError');
const { ASSIGNABLE_LOCATION_TYPES } = require('../config/constants');

const assertAssignableLocation = async (id) => {
  const location = await prisma.location.findUnique({
    where: { id },
    select: { name: true, type: true },
  });
  if (!location) throw new ApiError(404, 'Location not found');
  if (!ASSIGNABLE_LOCATION_TYPES.includes(location.type)) {
    throw new ApiError(
      400,
      `Assets can only be placed in: ${ASSIGNABLE_LOCATION_TYPES.join(', ')} (got ${location.type})`
    );
  }
  return location;
};

const assertActiveUser = async (id, label = 'User', role) => {
  const user = await prisma.user.findFirst({
    where: { id, isActive: true, ...(role ? { role } : {}) },
    select: { fullName: true, role: true },
  });
  if (!user) throw new ApiError(404, `${label} not found or inactive${role ? ` (must be ${role})` : ''}`);
  return user;
};

const categoryExists = async (id) =>
  Boolean(await prisma.category.findUnique({ where: { id }, select: { id: true } }));

module.exports = { assertAssignableLocation, assertActiveUser, categoryExists };
