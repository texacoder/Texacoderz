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

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

// One pooled connection per serverless function instance — Vercel Node
// functions handle one request at a time per instance, and keeping this
// small avoids exhausting the database's connection limit when many
// function instances are warm at once.
const pool = connectionString ? new Pool({ connectionString, max: 1 }) : null;

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
