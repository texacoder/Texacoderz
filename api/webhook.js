// POST /api/webhook
// Razorpay webhook receiver — the reliable, server-to-server confirmation
// channel that doesn't depend on the customer's browser staying open long
// enough to fire the Checkout `handler` callback (see verify-payment.js
// for that synchronous path). Configure this URL in the Razorpay
// Dashboard under Settings → Webhooks, subscribed to at least
// "payment.captured" and "payment.failed", with a webhook secret set
// as RAZORPAY_WEBHOOK_SECRET here.
//
// Idempotency: this handler currently has no persisted side effects
// (no database is configured for this project — Razorpay's own
// dashboard is the record of truth), so re-delivery of the same event
// by Razorpay's retry mechanism is always safe to process again as-is.
// If a database is added later, dedupe on the `id` field of the event
// body (the webhook event id) before acting on it.
const crypto = require('crypto');

// Disable the platform's default JSON body parsing so we can verify the
// signature against the exact raw bytes Razorpay signed.
module.exports.config = { api: { bodyParser: false } };

function readRawBody(req){
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function timingSafeEqualHex(expectedHex, givenHex){
  try {
    const a = Buffer.from(expectedHex, 'hex');
    const b = Buffer.from(String(givenHex), 'hex');
    if(a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

module.exports = async (req, res) => {
  if(req.method !== 'POST') return res.status(405).end();

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if(!secret){
    console.error('webhook: RAZORPAY_WEBHOOK_SECRET is not configured');
    return res.status(500).end();
  }

  const signature = req.headers['x-razorpay-signature'];
  if(!signature){
    return res.status(400).json({ error: 'Missing signature header' });
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (err){
    return res.status(400).json({ error: 'Could not read request body' });
  }

  const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if(!timingSafeEqualHex(expectedSignature, signature)){
    console.warn('webhook: invalid signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err){
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  const paymentId = event?.payload?.payment?.entity?.id;
  switch(event.event){
    case 'payment.captured':
      console.log('webhook: payment captured', paymentId);
      break;
    case 'payment.failed':
      console.log('webhook: payment failed', paymentId);
      break;
    default:
      console.log('webhook: unhandled event', event.event);
  }

  return res.status(200).json({ received: true });
};
