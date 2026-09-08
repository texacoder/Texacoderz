// GET /api/auth/me
// Returns the signed-in user for the current session cookie, or 401 if
// there isn't a valid one. This is the single source of truth the
// frontend uses to decide whether to show the logged-in or logged-out
// nav state — it never trusts the cookie's mere presence, only a server
// round-trip that re-verifies the JWT signature and checks the user's
// session_version still matches (so a password reset elsewhere
// immediately invalidates this session too).
const { sql } = require('../../lib/db');
const { getSessionPayloadFromRequest } = require('../../lib/session');
const { setCors } = require('../../lib/http');

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const payload = getSessionPayloadFromRequest(req);
  if (!payload || !payload.uid) {
    return res.status(401).json({ error: 'Not signed in.' });
  }

  try {
    const result = await sql`select id, name, email, session_version from users where id = ${payload.uid}`;
    const user = result.rows[0];

    if (!user || user.session_version !== payload.sv) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    return res.status(200).json({ id: user.id, name: user.name, email: user.email });
  } catch (err) {
    console.error('me: unexpected error', err);
    return res.status(500).json({ error: 'Something went wrong.' });
  }
};
