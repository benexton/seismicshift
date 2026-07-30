-- =============================================================================
-- VERT Kumamoto 2026 — Supabase / PostGIS schema
-- Run in the Supabase SQL editor (or `supabase db push`) on a fresh project.
-- =============================================================================

-- 1. Extensions ---------------------------------------------------------------
create extension if not exists postgis;   -- geospatial types + GIST indexing
create extension if not exists pgcrypto;   -- gen_random_uuid()

-- 2. Enumerated status --------------------------------------------------------
do $$ begin
  create type triage_status as enum ('Unverified','Approved','Rejected');
exception when duplicate_object then null; end $$;

-- 3. Core table ---------------------------------------------------------------
create table if not exists public.triage_records (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- Provenance --------------------------------------------------------------
  source_url         text,                      -- social media / news feed link
  media_url          text,                      -- image / video still
  external_id        text unique,               -- idempotency key from the scraper
  phash              text,                       -- perceptual hash (dedup audit trail)

  -- Geospatial --------------------------------------------------------------
  geom               geometry(Point, 4326) not null,
  -- ST_X / ST_Y are IMMUTABLE, so these generated columns let the client read
  -- plain lon/lat without ever touching the raw WKB geometry.
  longitude          double precision generated always as (st_x(geom)) stored,
  latitude           double precision generated always as (st_y(geom)) stored,
  region             text,                       -- prefecture / municipality / ward

  -- AI-generated metadata (written by the GitHub Actions pipeline) ----------
  damage_score       smallint check (damage_score between 0 and 4),
  code_era           text,                       -- e.g. 'pre-1981', '1981-2000', 'post-2000'
  failure_mechanism  text,                       -- free text from the LLM
  observed_retrofits text,                        -- 'tension-only bracing', 'friction dampers', 'none', ...
  ai_confidence      numeric(4,3),               -- 0.000 – 1.000
  ai_model           text,                       -- provenance of the triage (e.g. 'gpt-4o')

  -- Engineer-in-the-loop verification ---------------------------------------
  status             triage_status not null default 'Unverified',
  engineer_notes     text,
  reviewed_by        text,
  reviewed_at        timestamptz
);

comment on table public.triage_records is
  'Crowdsourced building-damage observations with AI triage metadata and engineer verification.';

-- 4. Indexes ------------------------------------------------------------------
create index if not exists triage_geom_gix    on public.triage_records using gist (geom);
create index if not exists triage_status_ix   on public.triage_records (status);
create index if not exists triage_region_ix   on public.triage_records (region);

-- 5. updated_at trigger -------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_touch_updated_at on public.triage_records;
create trigger trg_touch_updated_at
  before update on public.triage_records
  for each row execute function public.touch_updated_at();

-- 6. Ingestion RPC ------------------------------------------------------------
-- Called by scripts/ingest_triage_data.py with the SERVICE ROLE key. Builds the
-- PostGIS point from lon/lat and upserts on external_id so re-runs are idempotent
-- and never clobber a record an engineer has already actioned.
create or replace function public.ingest_triage(
  p_external_id       text,
  p_lng               double precision,
  p_lat               double precision,
  p_source_url        text default null,
  p_media_url         text default null,
  p_phash             text default null,
  p_region            text default null,
  p_damage_score      smallint default null,
  p_code_era          text default null,
  p_failure_mechanism text default null,
  p_observed_retrofits text default null,
  p_ai_confidence     numeric default null,
  p_ai_model          text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.triage_records as t (
    external_id, geom, source_url, media_url, phash, region,
    damage_score, code_era, failure_mechanism, observed_retrofits,
    ai_confidence, ai_model
  ) values (
    p_external_id,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326),
    p_source_url, p_media_url, p_phash, p_region,
    p_damage_score, p_code_era, p_failure_mechanism, p_observed_retrofits,
    p_ai_confidence, p_ai_model
  )
  on conflict (external_id) do update set
    -- refresh AI fields on re-ingest, but leave anything already triaged alone
    geom               = excluded.geom,
    source_url         = excluded.source_url,
    media_url          = excluded.media_url,
    phash              = excluded.phash,
    region             = excluded.region,
    damage_score       = case when t.status = 'Unverified' then excluded.damage_score       else t.damage_score end,
    code_era           = case when t.status = 'Unverified' then excluded.code_era           else t.code_era end,
    failure_mechanism  = case when t.status = 'Unverified' then excluded.failure_mechanism  else t.failure_mechanism end,
    observed_retrofits = case when t.status = 'Unverified' then excluded.observed_retrofits else t.observed_retrofits end,
    ai_confidence      = excluded.ai_confidence,
    ai_model           = excluded.ai_model
  returning t.id into v_id;
  return v_id;
end $$;

-- 7. Row Level Security -------------------------------------------------------
alter table public.triage_records enable row level security;

-- Only signed-in volunteers may read the triage queue / approved records.
drop policy if exists "authenticated read" on public.triage_records;
create policy "authenticated read"
  on public.triage_records for select
  to authenticated
  using (true);

-- Signed-in volunteers may update review fields (status, notes, reviewer).
drop policy if exists "authenticated update" on public.triage_records;
create policy "authenticated update"
  on public.triage_records for update
  to authenticated
  using (true)
  with check (true);

-- INSERT/DELETE are not granted to anon/authenticated: ingestion happens only
-- through ingest_triage() called with the service role (which bypasses RLS).

-- 8. Optional demo data -------------------------------------------------------
-- Points around Kumamoto City / Mashiki, Kumamoto Prefecture.
insert into public.triage_records (external_id, geom, source_url, media_url, region,
  damage_score, code_era, failure_mechanism, observed_retrofits, ai_confidence, ai_model)
values
 ('demo-0001', st_setsrid(st_makepoint(130.8190, 32.7898),4326),
  'https://example.org/post/1','https://placehold.co/640x420?text=RC+soft+story','Mashiki, Kumamoto',
  4,'pre-1981','soft-story collapse (ground floor)','none',0.83,'demo'),
 ('demo-0002', st_setsrid(st_makepoint(130.7417, 32.8032),4326),
  'https://example.org/post/2','https://placehold.co/640x420?text=URM+out-of-plane','Kumamoto City (Chuo)',
  3,'pre-1981','out-of-plane masonry wall failure','none',0.71,'demo'),
 ('demo-0003', st_setsrid(st_makepoint(130.7050, 32.7550),4326),
  'https://example.org/post/3','https://placehold.co/640x420?text=RC+infill','Kumamoto City (Minami)',
  2,'1981-2000','masonry infill cracking','tension-only bracing',0.64,'demo'),
 ('demo-0004', st_setsrid(st_makepoint(130.7700, 32.8890),4326),
  'https://example.org/post/4','https://placehold.co/640x420?text=Timber','Kikuchi, Kumamoto',
  1,'post-2000','minor connection damage','supplementary friction dampers',0.58,'demo')
on conflict (external_id) do nothing;
