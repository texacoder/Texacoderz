// Session cookie handling for /api/auth/*.
//
// Sessions are signed JWTs (userId + a per-user sessionVersion) stored in
// an HttpOnly cookie — never in localStorage/sessionStorage, so page JS
// can't read or leak the token, and the browser resends it automatically
// on every request, including after a full browser restart (Max-Age is
// set, so this is a persistent cookie, not a session-only one).
//
// sessionVersion lets us invalidate every existing session for a user in
// one move (e.g. on password reset) by bumping users.session_version —
// old tokens still verify cryptographically but no longer match, so
// verifySessionAgainstUser() rejects them.
const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'texa_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds — "stay logged in" by default

function isProd() {
  return process.env.NODE_ENV === 'production';
}

function isCrossSiteMode() {
  const origin = process.env.ALLOWED_ORIGIN;
  return !!origin && origin !== '*';
}

function getSessionSecret() {
  return process.env.SESSION_SECRET || null;
}

function signSession(payload) {
  const secret = getSessionSecret();
  if (!secret) throw new Error('SESSION_SECRET is not configured');
  return jwt.sign(payload, secret, { expiresIn: SESSION_MAX_AGE });
}

function verifySession(token) {
  const secret = getSessionSecret();
  if (!secret || !token) return null;
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

function serializeCookie(name, value, { maxAge, httpOnly = true, secure = true, sameSite = 'Lax', path = '/' } = {}) {
  let str = `${name}=${encodeURIComponent(value)}; Path=${path}`;
  if (maxAge !== undefined) str += `; Max-Age=${maxAge}`;
  if (httpOnly) str += '; HttpOnly';
  if (secure) str += '; Secure';
  if (sameSite) str += `; SameSite=${sameSite}`;
  return str;
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

function cookieAttributes() {
  const secure = isProd();
  // SameSite=None is only valid (and only sent by browsers) alongside
  // Secure, and is only needed when the frontend and API are on different
  // origins (e.g. GitHub Pages + a separate Vercel deployment) — the
  // README's recommended single-Vercel-project deployment is same-origin
  // and works fine with the Lax default.
  const sameSite = isCrossSiteMode() && secure ? 'None' : 'Lax';
  return { secure, sameSite };
}

function buildSessionCookie(token) {
  const { secure, sameSite } = cookieAttributes();
  return serializeCookie(COOKIE_NAME, token, { maxAge: SESSION_MAX_AGE, httpOnly: true, secure, sameSite });
}

function buildClearCookie() {
  const { secure, sameSite } = cookieAttributes();
  return serializeCookie(COOKIE_NAME, '', { maxAge: 0, httpOnly: true, secure, sameSite });
}

function getSessionPayloadFromRequest(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifySession(token);
}

module.exports = {
  COOKIE_NAME,
  SESSION_MAX_AGE,
  signSession,
  verifySession,
  buildSessionCookie,
  buildClearCookie,
  getSessionPayloadFromRequest,
};
