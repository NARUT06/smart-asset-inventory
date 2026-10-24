const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { changedPasswordAfter } = require('../utils/password');

const extractToken = (req) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
};

const authenticate = async (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // Tokens issued before the PostgreSQL migration carry a Mongo ObjectId string: reject them
  const found = Number.isInteger(decoded.id)
    ? await prisma.user.findUnique({ where: { id: decoded.id } })
    : null;
  if (!found || !found.isActive) {
    throw new ApiError(401, 'The user belonging to this token no longer exists or is deactivated');
  }

  // eslint-disable-next-line no-unused-vars
  const { passwordHash, ...user } = found;
  if (changedPasswordAfter(user, decoded.iat)) {
    throw new ApiError(401, 'Password was changed recently. Please log in again');
  }
  return { ...user, _id: user.id };
};

// Requires a valid JWT and attaches the user to req.user
const protect = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw new ApiError(401, 'Authentication required. Please log in');
  req.user = await authenticate(token);
  next();
});

// Attaches req.user when a valid token is present, but does not require one
const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (token) req.user = await authenticate(token);
  next();
});

// RBAC: authorize(ROLES.ADMIN, ROLES.PROCUREMENT)
const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(new ApiError(401, 'Authentication required. Please log in'));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, `Role ${req.user.role} is not allowed to perform this action`));
    }
    next();
  };

module.exports = { protect, optionalAuth, authorize };
