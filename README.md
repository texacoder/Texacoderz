# Texacoderzz website

Static site (`*.html`, `styles.css`, `main.js`) plus a small set of
serverless functions under `/api` that power the **Buy Us a Coffee**
payment flow (`support.html`, `coffee.js`).

## Local development

No build step for the static pages — open the HTML files directly, or
serve the folder with any static file server. The `/api` functions need
a serverless-capable runner such as `vercel dev` (install the Vercel CLI,
then `vercel dev` from this folder) to run locally.

```
npm install
vercel dev
```

## Deploying

The static pages can be hosted anywhere (GitHub Pages, Vercel, Netlify).
The `/api` functions require a serverless/Node runtime — **Vercel** is
the recommended target: connect this repo, and Vercel automatically
serves the HTML files as static assets and deploys everything in `/api`
as serverless functions, with no extra config needed. If the static site
stays on GitHub Pages while `/api` moves to Vercel, set `ALLOWED_ORIGIN`
(see below) to the GitHub Pages URL so the API only accepts requests from
there.

## Buy Us a Coffee — payment setup (Razorpay)

The support page (`support.html`) never talks to Razorpay directly with a
secret key. The flow is:

1. Visitor picks/enters an amount → `coffee.js` calls `POST /api/create-order`.
2. `api/create-order.js` validates the amount server-side (₹10–₹25,000),
   creates a Razorpay order with the secret key, and returns only the
   order id, amount, currency, and the *public* Key ID.
3. `coffee.js` opens Razorpay's official Checkout modal with that order.
4. On completion, Checkout hands back a payment id + signature, which
   `coffee.js` sends to `POST /api/verify-payment` — this recomputes the
   HMAC signature server-side and only returns `success: true` if it
   matches. The frontend never decides success on its own.
5. `POST /api/webhook` is Razorpay's independent, asynchronous
   confirmation channel (configure it in the Razorpay Dashboard) —
   useful if a visitor closes the tab before step 4 completes.

### Environment variables

Copy `.env.example` to `.env` for local dev, and set the same names as
encrypted environment variables in your hosting provider's dashboard for
production. **Never commit `.env`.**

| Variable | Where to find it | Safe to expose to the browser? |
|---|---|---|
| `RAZORPAY_KEY_ID` | Razorpay Dashboard → Settings → API Keys | Yes — this is the public key, returned to the frontend by `/api/create-order` on purpose. |
| `RAZORPAY_KEY_SECRET` | Same page, shown once when a key pair is generated | **No — server-side only.** Never put this in any HTML/JS file. |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Dashboard → Settings → Webhooks, when you add the webhook | **No — server-side only.** |
| `ALLOWED_ORIGIN` | You choose this (your site's URL) | N/A — it's a config value, not a secret. |

If you ever paste a secret into a chat, an issue, or a commit by mistake,
treat it as compromised and regenerate it immediately from the Razorpay
Dashboard.
