const bcrypt = require('bcryptjs');

const hashPassword = (plain) => bcrypt.hash(plain, 12);
const comparePassword = (plain, hash) => bcrypt.compare(plain, hash);

const changedPasswordAfter = (user, jwtIssuedAtSeconds) => {
  if (!user.passwordChangedAt) return false;
  return Math.floor(user.passwordChangedAt.getTime() / 1000) > jwtIssuedAtSeconds;
};

module.exports = { hashPassword, comparePassword, changedPasswordAfter };
