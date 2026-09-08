// POST /api/auth/reset-password
// Consumes a one-time reset token (emailed by /api/auth/forgot-password),
// sets a new password, invalidates every other session for the account by
// bumping session_version, and signs the visitor in with a fresh session
// cookie so they land back on the site already logged in.
const crypto = require('crypto');
const { sql } = require('../../lib/db');
const { hashPassword } = require('../../lib/password');
const { signSession, buildSessionCookie } = require('../../lib/session');
const { setCors, isRateLimited, clientIp } = require('../../lib/http');

const MIN_PASSWORD_LENGTH = 8;
const INVALID_TOKEN_ERROR = 'This reset link is invalid or has expired. Please request a new one.';

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = clientIp(req);
  if (isRateLimited(`reset:${ip}`, { windowMs: 60 * 1000, max: 10 })) {
    return res.status(429).json({ error: 'Too many attempts — please wait a moment and try again.' });
  }

  const body = req.body || {};
  const token = typeof body.token === 'string' ? body.token : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!token) {
    return res.status(400).json({ error: INVALID_TOKEN_ERROR });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  try {
    const result = await sql`
      select id, user_id from password_resets
      where token_hash = ${tokenHash} and used_at is null and expires_at > now()
    `;
    const record = result.rows[0];
    if (!record) {
      return res.status(400).json({ error: INVALID_TOKEN_ERROR });
    }

    const passwordHash = await hashPassword(password);

    const updated = await sql`
      update users
      set password_hash = ${passwordHash}, session_version = session_version + 1
      where id = ${record.user_id}
      returning id, name, email, session_version
    `;
    const user = updated.rows[0];
    if (!user) {
      return res.status(400).json({ error: INVALID_TOKEN_ERROR });
    }

    await sql`update password_resets set used_at = now() where id = ${record.id}`;

    const sessionToken = signSession({ uid: user.id, sv: user.session_version });
    res.setHeader('Set-Cookie', buildSessionCookie(sessionToken));

    return res.status(200).json({ id: user.id, name: user.name, email: user.email });
  } catch (err) {
    console.error('reset-password: unexpected error', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
