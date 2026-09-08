// POST /api/auth/login
// Verifies email + password and, on success, signs the visitor in via an
// HttpOnly session cookie. Returns the same generic error for "no such
// account" and "wrong password" so a login attempt can't be used to probe
// which emails have accounts.
const { sql } = require('../../lib/db');
const { verifyPassword } = require('../../lib/password');
const { signSession, buildSessionCookie } = require('../../lib/session');
const { setCors, isRateLimited, clientIp, isValidEmail, normalizeEmail } = require('../../lib/http');

const GENERIC_ERROR = 'Incorrect email or password.';

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = clientIp(req);
  if (isRateLimited(`login:${ip}`, { windowMs: 60 * 1000, max: 15 })) {
    return res.status(429).json({ error: 'Too many attempts — please wait a moment and try again.' });
  }

  if (!process.env.SESSION_SECRET) {
    console.error('login: SESSION_SECRET is not configured');
    return res.status(500).json({ error: 'Login is temporarily unavailable. Please try again later.' });
  }

  const body = req.body || {};
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!isValidEmail(email) || !password) {
    return res.status(400).json({ error: GENERIC_ERROR });
  }

  try {
    const result = await sql`select id, name, email, password_hash, session_version from users where email = ${email}`;
    const user = result.rows[0];

    // Always run bcrypt.compare, even for a nonexistent user, against a
    // fixed dummy hash — keeps response timing roughly constant so an
    // attacker can't distinguish "no such email" from "wrong password"
    // by measuring how fast the request came back.
    const hashToCheck = user ? user.password_hash : '$2a$12$C6UzMDM.H6dfI/f/IKcEeOFQ3v3JhOG5rN2VfXQaVv2W5Q3F6z8pO';
    const passwordOk = await verifyPassword(password, hashToCheck);

    if (!user || !passwordOk) {
      return res.status(401).json({ error: GENERIC_ERROR });
    }

    const token = signSession({ uid: user.id, sv: user.session_version });
    res.setHeader('Set-Cookie', buildSessionCookie(token));

    return res.status(200).json({ id: user.id, name: user.name, email: user.email });
  } catch (err) {
    console.error('login: unexpected error', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
