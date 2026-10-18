-- Job closeout (smallest version). Contract: docs/release-beta/CONTRACT.md "Job closeout".
-- A closed job is a read-only record: it still opens, reads and prints, but no edits.
-- No reopen in this release. Existing rows become 'open'.

alter table projects add column if not exists status text not null default 'open';
alter table projects add column if not exists closed_at timestamptz;
alter table projects add column if not exists closed_by text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_status_check') then
    alter table projects add constraint projects_status_check check (status in ('open', 'closed'));
  end if;
end $$;
