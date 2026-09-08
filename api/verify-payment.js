// POST /api/verify-payment
// Verifies the signature Razorpay Checkout hands back to the browser
// after a payment attempt. This is what turns a client-side "it looked
// successful" into a server-confirmed success — the frontend must never
// treat a payment as successful on its own say-so.
// Requires RAZORPAY_KEY_SECRET as an environment variable.
const crypto = require('crypto');

function setCors(res){
  const origin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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
  setCors(res);
  if(req.method === 'OPTIONS') return res.status(204).end();
  if(req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if(!razorpay_order_id || !razorpay_payment_id || !razorpay_signature){
    return res.status(400).json({ success: false, error: 'Missing payment verification fields.' });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if(!keySecret){
    console.error('verify-payment: Razorpay secret is not configured');
    return res.status(500).json({ success: false, error: 'Verification is temporarily unavailable.' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const isValid = timingSafeEqualHex(expectedSignature, razorpay_signature);

  if(!isValid){
    console.warn('verify-payment: signature mismatch for order', razorpay_order_id);
    return res.status(400).json({ success: false, error: 'Payment could not be verified.' });
  }

  return res.status(200).json({ success: true, orderId: razorpay_order_id, paymentId: razorpay_payment_id });
};
