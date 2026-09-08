// Small helpers shared by /api/auth/* — CORS, best-effort in-memory rate
// limiting, and validation, following the same patterns already used by
// /api/create-order.js and /api/verify-payment.js.
function setCors(req, res) {
  const allowed = process.env.ALLOWED_ORIGIN || '*';
  // Credentialed requests (cookies) can never use "*" as the allowed
  // origin per the fetch/CORS spec, so once ALLOWED_ORIGIN names a real
  // origin we echo it back with credentials enabled. With no explicit
  // ALLOWED_ORIGIN set, we fall back to same-origin-only behavior (no
  // Access-Control-Allow-Origin at all) — the recommended single-Vercel-
  // project deployment never needs cross-origin cookies in the first
  // place.
  if (allowed !== '*') {
    res.setHeader('Access-Control-Allow-Origin', allowed);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const hits = new Map();
function isRateLimited(key, { windowMs = 60 * 1000, max = 10 } = {}) {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now - entry.start > windowMs) {
    hits.set(key, { count: 1, start: now });
    return false;
  }
  entry.count += 1;
  return entry.count > max;
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

function isValidEmail(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function normalizeEmail(v) {
  return typeof v === 'string' ? v.trim().toLowerCase() : '';
}

module.exports = { setCors, isRateLimited, clientIp, isValidEmail, normalizeEmail };
