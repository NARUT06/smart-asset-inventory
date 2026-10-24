const ApiError = require('../utils/ApiError');

const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

// Prisma reports the violated columns in meta.target (array, or a constraint name string)
const uniqueFields = (err) => {
  const target = err.meta && err.meta.target;
  if (Array.isArray(target)) return target;
  if (typeof target === 'string') return [target];
  return [];
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let details = err.details;

  if (err.name === 'PrismaClientKnownRequestError' && err.code === 'P2002') {
    // Unique constraint violation
    statusCode = 409;
    const fields = uniqueFields(err);
    message = `Duplicate value for: ${fields.join(', ') || 'unique field'}`;
    details = Object.fromEntries(
      fields.filter((f) => req.body && req.body[f] !== undefined).map((f) => [f, req.body[f]])
    );
  } else if (err.name === 'PrismaClientKnownRequestError' && err.code === 'P2003') {
    // Foreign key violation (missing referenced row, or row still referenced)
    statusCode = 409;
    message = 'Operation blocked by a related record (referenced record is missing or still in use)';
    details = undefined;
  } else if (err.name === 'PrismaClientKnownRequestError' && err.code === 'P2025') {
    // Update/delete target no longer exists
    statusCode = 404;
    message = 'Record not found';
    details = undefined;
  } else if (err.name === 'PrismaClientValidationError') {
    statusCode = 400;
    message = 'Invalid data';
    details = undefined;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token. Please log in again';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired. Please log in again';
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Malformed JSON in request body';
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body too large';
  }

  if (statusCode >= 500) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
    if (process.env.NODE_ENV === 'production' && !err.isOperational) {
      message = 'Internal Server Error';
      details = undefined;
    }
  }

  const body = { success: false, message };
  if (details !== undefined) body.errors = details;
  if (process.env.NODE_ENV !== 'production' && statusCode >= 500) body.stack = err.stack;

  res.status(statusCode).json(body);
};

module.exports = { notFound, errorHandler };
