// Password hashing — bcrypt, cost factor 12. Plaintext passwords never
// reach the database or any log line; only this hash is stored.
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = { hashPassword, verifyPassword };
