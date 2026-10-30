-- Guest carry-over is idempotent (P1, guest carry-over duplicates).
-- One row per device (guest) item that has been moved into an account. The key is per user, so a
-- repeat claim (reload, double click, two tabs, sign-in then refresh) finds the row and adds nothing,
-- and another account can't use a leaked device id to reach this account's copy.

create table if not exists guest_claims (
  user_id text not null,
  kind text not null,
  guest_id text not null,
  server_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, guest_id)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'guest_claims_kind_check') then
    alter table guest_claims add constraint guest_claims_kind_check check (kind in ('project', 'custom'));
  end if;
end $$;
