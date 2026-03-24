const crypto = require('crypto');

const KEY_LENGTH = 64;

function getScryptParams(rounds) {
  const normalizedRounds = Math.max(1, Number(rounds) || 10);

  return {
    N: 2 ** Math.min(15, normalizedRounds + 8),
    r: 8,
    p: 1
  };
}

async function hash(plainText, rounds = 10) {
  const input = String(plainText ?? '');
  const salt = crypto.randomBytes(16).toString('hex');
  const { N, r, p } = getScryptParams(rounds);

  const derivedKey = await new Promise((resolve, reject) => {
    crypto.scrypt(input, salt, KEY_LENGTH, { N, r, p }, (error, key) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(key);
    });
  });

  return [N, r, p, salt, Buffer.from(derivedKey).toString('hex')].join('$');
}

async function compare(plainText, hashedValue) {
  const input = String(plainText ?? '');

  if (!hashedValue || typeof hashedValue !== 'string') {
    return false;
  }

  const [nRaw, rRaw, pRaw, salt, storedHash] = hashedValue.split('$');

  if (!nRaw || !rRaw || !pRaw || !salt || !storedHash) {
    return false;
  }

  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);

  if (![N, r, p].every(Number.isFinite)) {
    return false;
  }

  const derivedKey = await new Promise((resolve, reject) => {
    crypto.scrypt(input, salt, KEY_LENGTH, { N, r, p }, (error, key) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(key);
    });
  });

  const storedBuffer = Buffer.from(storedHash, 'hex');
  const derivedBuffer = Buffer.from(derivedKey);

  if (storedBuffer.length !== derivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedBuffer, derivedBuffer);
}

module.exports = {
  hash,
  compare
};
