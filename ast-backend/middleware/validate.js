const { validationResult, param } = require('express-validator');
const ApiError = require('../utils/ApiError');

// Prisma autoincrement Int (PostgreSQL INTEGER)
const ID_OPTS = { min: 1, max: 2147483647 };

// Place after express-validator chains
const validate = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
  next(new ApiError(422, 'Validation failed', errors));
};

const idParam = (name = 'id') =>
  param(name).isInt(ID_OPTS).withMessage(`Invalid ${name}`).toInt();

module.exports = { validate, idParam, ID_OPTS };
