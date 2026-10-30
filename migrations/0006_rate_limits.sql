-- Shared-database rate limits and login lockout (item 3). One row per (bucket, key).
-- `key` is a sha256 hex of the raw key, so no email or IP is stored.
-- Numbered 0006: PR #51 adds 0005_guest_claims.sql. Files apply in name order and each is tracked
-- in _migrations, so either PR can merge first.
-- `allowed` holds the decision of the latest take; it is computed in the same UPDATE from the row's
-- previous values (including a still-active lock), so the decision is atomic under concurrency.
create table if not exists rate_limits (
  bucket       text        not null,
  key          text        not null,
  window_start timestamptz not null,
  count        integer     not null,
  locked_until timestamptz,
  expires_at   timestamptz not null,
  allowed      boolean     not null default true,
  primary key (bucket, key)
);

create index if not exists rate_limits_expires_at on rate_limits (expires_at);
