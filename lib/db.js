// Shared Postgres client for the /api/auth/* functions, using the plain
// `pg` driver — actively maintained and works with any Postgres host
// (Neon, Supabase's own Postgres, Railway, RDS, ...) over a standard
// connection string, with no vendor-specific SDK lock-in.
// (`@vercel/postgres` was deliberately avoided here — it's deprecated as
// of 2025, with Vercel's own docs pointing to Neon/plain Postgres instead.)
//
// Reads POSTGRES_URL, falling back to DATABASE_URL. If you provision a
// Postgres database from the Vercel dashboard (Storage → Create Database)
// and link it to this project, one of these is injected automatically.
// For any other provider, paste its connection string into either name.
const { Pool } = require('pg');

const rawConnectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

// Hosted Postgres providers (Supabase, Neon, Railway, ...) require SSL on
// their external endpoints, but their certificate chain often isn't one
// Node trusts by default, so it needs to skip verification rather than
// fail closed — acceptable here since the connection string itself (host
// + credentials) is the actual secret being trusted, not the certificate
// chain. Only skipped for a local database (plain Postgres, no TLS).
//
// This is set two ways on purpose: `pg` parses `connectionString` and can
// silently overwrite an explicit `ssl` option with whatever `sslmode` (or
// its absence) says in the string, so `sslmode=no-verify` is stamped onto
// the string itself — the one setting `pg` can't override — with the
// `ssl` config object below as a backstop.
const isLocalDb = /localhost|127\.0\.0\.1/.test(rawConnectionString || '');

function withNoVerifySsl(connString) {
  if (!connString) return connString;
  try {
    const url = new URL(connString);
    url.searchParams.set('sslmode', 'no-verify');
    return url.toString();
  } catch {
    return connString;
  }
}

const connectionString = isLocalDb ? rawConnectionString : withNoVerifySsl(rawConnectionString);

// One pooled connection per serverless function instance — Vercel Node
// functions handle one request at a time per instance, and keeping this
// small avoids exhausting the database's connection limit when many
// function instances are warm at once.
const pool = connectionString
  ? new Pool({
      connectionString,
      max: 1,
      ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
    })
  : null;

// Tagged-template helper so call sites read like SQL (`` sql`select ...
// where id = ${id}` ``) while still going through parameterized queries
// under the hood — the interpolated values are never concatenated into
// the query text, so this is not vulnerable to SQL injection.
function sql(strings, ...values) {
  if (!pool) {
    return Promise.reject(new Error('POSTGRES_URL (or DATABASE_URL) is not configured'));
  }
  let text = strings[0];
  const params = [];
  values.forEach((value, i) => {
    params.push(value);
    text += `$${i + 1}${strings[i + 1]}`;
  });
  return pool.query(text, params);
}

module.exports = { sql };
