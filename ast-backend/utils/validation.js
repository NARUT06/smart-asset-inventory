const ApiError = require('./ApiError');

/**
 * Model-level validation (replaces the Mongoose schema validators).
 * Usage: assertValid([[field, isOk, message], ...]) -> 400 "Validation failed" with [{ field, message }]
 */
const assertValid = (checks) => {
  const errors = checks.filter(([, ok]) => !ok).map(([field, , message]) => ({ field, message }));
  if (errors.length) throw new ApiError(400, 'Validation failed', errors);
};

const maxLen = (value, max) => value === null || value === undefined || String(value).length <= max;
const tooLong = (field, max) => `${field} must be at most ${max} characters`;

module.exports = { assertValid, maxLen, tooLong };
