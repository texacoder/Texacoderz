// POST /api/auth/signup
// Creates a new account. Validates everything server-side (the frontend
// checks are only for a fast/friendly UX — never trusted here), hashes the
// password with bcrypt before it ever touches the database, and signs the
// visitor in immediately via an HttpOnly session cookie.
const { sql } = require('../../lib/db');
const { hashPassword } = require('../../lib/password');
const { signSession, buildSessionCookie } = require('../../lib/session');
const { setCors, isRateLimited, clientIp, isValidEmail, normalizeEmail } = require('../../lib/http');

const MIN_PASSWORD_LENGTH = 8;

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = clientIp(req);
  if (isRateLimited(`signup:${ip}`, { windowMs: 60 * 1000, max: 10 })) {
    return res.status(429).json({ error: 'Too many attempts — please wait a moment and try again.' });
  }

  if (!process.env.SESSION_SECRET) {
    console.error('signup: SESSION_SECRET is not configured');
    return res.status(500).json({ error: 'Account creation is temporarily unavailable. Please try again later.' });
  }

  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!name) {
    return res.status(400).json({ error: 'Please enter your name.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
  }

  try {
    const existing = await sql`select id from users where email = ${email}`;
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists. Try logging in instead.' });
    }

    const passwordHash = await hashPassword(password);
    const result = await sql`
      insert into users (name, email, password_hash)
      values (${name}, ${email}, ${passwordHash})
      returning id, name, email, session_version
    `;
    const user = result.rows[0];

    const token = signSession({ uid: user.id, sv: user.session_version });
    res.setHeader('Set-Cookie', buildSessionCookie(token));

    return res.status(201).json({ id: user.id, name: user.name, email: user.email });
  } catch (err) {
    // Unique-constraint race: two signups for the same email at once.
    if (err && err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists. Try logging in instead.' });
    }
    console.error('signup: unexpected error', err);
    // TEMPORARY — surfaces the real error to the client for debugging.
    // Revert this before real users sign up; it can leak infra details.
    return res.status(500).json({ error: 'Something went wrong creating your account. Please try again.', debug: err && (err.message || String(err)) });
  }
};
