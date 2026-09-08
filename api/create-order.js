// POST /api/create-order
// Creates a Razorpay order server-side. This is the only place the
// contribution amount is trusted — the client only ever *suggests*
// an amount, this endpoint validates and clamps it, and the Razorpay
// order that comes back is what the checkout modal actually charges.
// Requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET as environment
// variables (never hardcode them, never send the secret to the client).
const Razorpay = require('razorpay');

const MIN_AMOUNT_INR = 10;
const MAX_AMOUNT_INR = 25000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

// Best-effort in-memory rate limiting. Serverless instances are
// ephemeral and not shared, so this only throttles bursts against a
// single warm instance — it is not a substitute for a platform-level
// WAF/rate-limit rule for real abuse protection, but it costs nothing
// and blocks naive repeated-click abuse.
const hits = new Map();
function isRateLimited(key){
  const now = Date.now();
  const entry = hits.get(key);
  if(!entry || now - entry.start > RATE_LIMIT_WINDOW_MS){
    hits.set(key, { count: 1, start: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

function setCors(res){
  const origin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

module.exports = async (req, res) => {
  setCors(res);
  if(req.method === 'OPTIONS') return res.status(204).end();
  if(req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  if(isRateLimited(ip)){
    return res.status(429).json({ error: 'Too many requests — please wait a moment and try again.' });
  }

  const body = req.body || {};
  const amount = Number(body.amount);
  const email = typeof body.email === 'string' ? body.email.trim() : undefined;

  if(!Number.isFinite(amount) || !Number.isInteger(amount) || amount < MIN_AMOUNT_INR || amount > MAX_AMOUNT_INR){
    return res.status(400).json({ error: `Amount must be a whole number between ₹${MIN_AMOUNT_INR} and ₹${MAX_AMOUNT_INR}.` });
  }
  if(email && !validEmail(email)){
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if(!keyId || !keySecret){
    console.error('create-order: Razorpay credentials are not configured');
    return res.status(500).json({ error: 'Payments are temporarily unavailable. Please try again later.' });
  }

  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

  try {
    const order = await razorpay.orders.create({
      amount: amount * 100, // paise
      currency: 'INR',
      receipt: `coffee_${Date.now()}`,
      notes: email ? { email } : undefined,
    });

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId, // public Key ID — safe to expose to the browser
    });
  } catch(err){
    console.error('create-order: Razorpay order creation failed:', err?.error?.description || err.message);
    return res.status(502).json({ error: 'Could not start payment. Please try again.' });
  }
};
