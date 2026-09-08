-- Texacoderzz — account system schema
-- Run this once against your Postgres database (Vercel Postgres / Neon
-- query editor, or `psql "$POSTGRES_URL" -f db/schema.sql`) before the
-- /api/auth/* endpoints will work.

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  -- Bumped on password reset to invalidate every other signed-in session
  -- for this user in one move (old JWTs still verify cryptographically,
  -- but their embedded session_version no longer matches this column).
  session_version integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  -- We store only a SHA-256 hash of the reset token, never the token
  -- itself — mirrors how passwords are stored, so a database leak alone
  -- can't be used to reset anyone's password.
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_resets_user_id on password_resets(user_id);
