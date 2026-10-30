-- BUG-52-1 (PR #52): reservations still in flight, so a successful sign-in inside a burst can't
-- clear a count other attempts pushed to the cap. Additive; existing rows start at 0.
-- (Keys also switch to HMAC in the same PR, so rows written before it are simply never matched
-- again and age out: a one-time reset of limiter counts.)
alter table rate_limits add column if not exists pending integer not null default 0;
