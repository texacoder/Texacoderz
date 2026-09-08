// Sends the password-reset email via the Resend API (https://resend.com —
// a generous free tier, and the most common pairing for a Vercel-hosted
// project like this one). Uses a plain fetch call rather than the Resend
// SDK to avoid an extra dependency for what is one API call.
//
// If RESEND_API_KEY isn't set, this logs a warning and resolves without
// throwing — /api/auth/forgot-password intentionally returns the same
// generic "check your email" response either way, so a misconfigured
// mailer can never be used to probe whether an email address has an
// account. Check the Vercel function logs if reset emails aren't arriving.
async function sendPasswordResetEmail({ to, resetUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    console.warn('mailer: RESEND_API_KEY/RESEND_FROM_EMAIL not configured — password reset email not sent');
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject: 'Reset your Texacoderzz password',
      html: `
        <p>Someone requested a password reset for your Texacoderzz account.</p>
        <p><a href="${resetUrl}">Click here to set a new password</a> (this link expires in 1 hour).</p>
        <p>If you didn't request this, you can safely ignore this email — your password won't change.</p>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('mailer: Resend API error', res.status, body);
  }
}

module.exports = { sendPasswordResetEmail };
