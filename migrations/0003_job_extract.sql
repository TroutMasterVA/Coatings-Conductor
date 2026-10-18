-- BE-3: the extract record (provider, deployment, provenance, warnings, extractedAt, draft,
-- unverifiedTemps) saved next to card_json. Nullable: older jobs have none (treat as missing).
alter table projects add column if not exists extract_json text;
