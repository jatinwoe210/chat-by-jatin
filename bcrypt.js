const bcrypt = require('bcryptjs');

async function hash(plainText, rounds = 10) {
  const input = String(plainText ?? '');
  return bcrypt.hash(input, rounds);
}

async function compare(plainText, hashedValue) {
  const input = String(plainText ?? '');

  if (!hashedValue || typeof hashedValue !== 'string') {
    return false;
  }

  return bcrypt.compare(input, hashedValue);
}

module.exports = {
  hash,
  compare
};
