# Texacoderzz website

Static site (`*.html`, `styles.css`, `main.js`) plus a small set of
serverless functions under `/api` that power the **Buy Us a Coffee**
payment flow (`support.html`, `coffee.js`) and the **account system**
(Login / Sign Up, `auth.js`, `reset-password.html`).

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

## Accounts — Login / Sign Up

Every page's nav shows Login/Sign Up (or the account menu + Log Out, once
signed in) via `auth.js`, backed by `/api/auth/*` and a Postgres database.
Passwords are hashed with bcrypt before they're ever written to the
database — the plaintext password never reaches storage or a log line.
Sessions are an HttpOnly, signed-JWT cookie (`texa_session`, 30-day
expiry), so a visitor stays logged in across page refreshes and after
closing/reopening the browser, with no token ever stored in
localStorage/sessionStorage for page JS to read.

### One-time setup

1. **Provision a Postgres database.** Easiest path: Vercel dashboard →
   your project → Storage → Create Database → Postgres. Linking it to the
   project injects `POSTGRES_URL` automatically — nothing else to
   configure. (Any other Postgres host works too; just set `POSTGRES_URL`
   yourself.)
2. **Run the schema once**: open the database's query editor (or
   `psql "$POSTGRES_URL" -f db/schema.sql`) and run `db/schema.sql`. It
   creates the `users` and `password_resets` tables.
3. **Set `SESSION_SECRET`** (see `.env.example` for how to generate one).
   Required — without it, signup/login/etc. return a 500.
4. **Optional — password reset emails**: set `RESEND_API_KEY` and
   `RESEND_FROM_EMAIL` (see `.env.example`) to actually deliver the
   "forgot password" email via [Resend](https://resend.com). Without
   these, forgot-password requests still succeed from the visitor's point
   of view (so the response can never be used to probe which emails have
   accounts) but no email is sent — check the Vercel function logs.

### How it works

- `POST /api/auth/signup`, `/login`, `/logout`, `GET /api/auth/me` —
  account creation, login, logout, and "am I logged in" (used by `auth.js`
  to decide the nav state on every page load).
- `POST /api/auth/forgot-password` issues a one-hour, single-use reset
  token (only its SHA-256 hash is stored) and emails a link to
  `reset-password.html?token=...`. `POST /api/auth/reset-password`
  verifies it, sets the new password, and invalidates every other
  session for that account by bumping a `session_version` counter on the
  user — so a stolen or leaked old session cookie stops working the
  moment a password is reset.
- Same enumeration-resistance approach as the payment endpoints' careful
  server-side validation: login and forgot-password return identical,
  generic responses whether or not the email exists, so neither can be
  used to test which addresses are registered.
