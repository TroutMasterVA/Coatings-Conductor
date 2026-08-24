-- Per-user coating projects (isolated models) + shared custom-mitigation library.

create table if not exists projects (
  id text primary key,
  user_id text not null,
  name text not null,
  zip text not null default '',
  archived boolean not null default false,
  calibration_json text not null,
  site_json text not null,
  card_json text,
  pds_text text not null default '',
  recents_json text not null default '[]',
  outcomes_json text not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on projects (user_id);
create index if not exists projects_user_archived_idx on projects (user_id, archived);

create table if not exists custom_mitigations (
  id text primary key,
  user_id text not null,
  label text not null,
  payload_json text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists custom_mitigations_user_id_idx on custom_mitigations (user_id);

create table if not exists user_prefs (
  user_id text primary key,
  last_project_id text
);
