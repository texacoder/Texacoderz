// POST /api/auth/forgot-password
// Always responds with the same generic message, whether or not the email
// belongs to an account — that's deliberate: it stops this endpoint being
// usable to test which emails are registered. If the account exists, a
// one-time, one-hour reset link is emailed via Resend (see lib/mailer.js).
const crypto = require('crypto');
const { sql } = require('../../lib/db');
const { sendPasswordResetEmail, isConfigured: mailerConfigured } = require('../../lib/mailer');
const { setCors, isRateLimited, clientIp, isValidEmail, normalizeEmail } = require('../../lib/http');

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const GENERIC_MESSAGE = 'If an account exists for that email, a password reset link is on its way.';
// Shown instead of GENERIC_MESSAGE while no email provider is configured —
// this depends only on server config, never on whether the submitted
// email has an account, so it's still safe from an enumeration standpoint.
const NOT_CONFIGURED_MESSAGE = "Password reset emails aren't set up yet. Please contact us directly at texacoderzz@gmail.com to reset your password.";

function resolveSiteUrl(req) {
  if (process.env.PUBLIC_SITE_URL) return process.env.PUBLIC_SITE_URL.replace(/\/$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  return `${proto}://${host}`;
}

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const responseMessage = mailerConfigured() ? GENERIC_MESSAGE : NOT_CONFIGURED_MESSAGE;

  const ip = clientIp(req);
  if (isRateLimited(`forgot:${ip}`, { windowMs: 60 * 1000, max: 5 })) {
    // Still the same message — even rate-limit timing shouldn't leak
    // whether the account exists.
    return res.status(200).json({ message: responseMessage });
  }

  const email = normalizeEmail((req.body || {}).email);
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  if (!mailerConfigured()) {
    // No point generating and storing a token that can never be emailed.
    return res.status(200).json({ message: responseMessage });
  }

  try {
    const result = await sql`select id from users where email = ${email}`;
    const user = result.rows[0];

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

      // Clear any still-valid earlier links for this user so only the
      // newest one works.
      await sql`delete from password_resets where user_id = ${user.id} and used_at is null`;
      await sql`
        insert into password_resets (user_id, token_hash, expires_at)
        values (${user.id}, ${tokenHash}, ${expiresAt})
      `;

      const resetUrl = `${resolveSiteUrl(req)}/reset-password.html?token=${token}`;
      await sendPasswordResetEmail({ to: email, resetUrl });
    }

    return res.status(200).json({ message: responseMessage });
  } catch (err) {
    console.error('forgot-password: unexpected error', err);
    // Same message even on an internal error, for the same
    // enumeration-resistance reason as above; the failure is visible in
    // the Vercel function logs for the site owner.
    return res.status(200).json({ message: responseMessage });
  }
};
