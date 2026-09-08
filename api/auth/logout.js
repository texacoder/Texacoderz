// POST /api/auth/logout
// Clears the session cookie. There's no server-side session store to
// clean up (the cookie itself is the session), so this never fails.
const { setCors } = require('../../lib/http');
const { buildClearCookie } = require('../../lib/session');

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  res.setHeader('Set-Cookie', buildClearCookie());
  return res.status(200).json({ success: true });
};
