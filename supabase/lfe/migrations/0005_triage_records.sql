-- Mirrors the real (production) Kumamoto triage_records shape, plus event_id.
-- site_id is the per-event sequential display number ("Site #12"), assigned by
-- the trigger in 0006_site_numbering.sql - it is not the primary key.

create table public.triage_records (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  site_id integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Provenance
  source_type text not null default 'human' check (source_type in ('human', 'bluesky', 'rss', 'other')),
  submitted_by text,
  external_id text,
  source_url text,

  -- Media
  media_url text,
  phash text,
  streetview_url text,

  -- Location (geom is authoritative; lat/lng are generated for easy reads)
  geom geometry(Point, 4326) not null,
  longitude double precision generated always as (st_x(geom)) stored,
  latitude double precision generated always as (st_y(geom)) stored,
  location_precision text not null default 'exact' check (location_precision in ('exact', 'approximate')),
  location_confidence text check (location_confidence in ('high', 'medium', 'low')),
  region text,
  address text,

  -- Classification. observation_types is multi-select (a record can be both a
  -- building and a lifeline observation, for example). The two array-length
  -- guards matter: a bare "array_length(...) > 0" and a containment check
  -- against an array holding a null element both evaluate to NULL rather than
  -- FALSE in Postgres, and a CHECK constraint only rejects FALSE - so without
  -- these an empty array or a null-laced array would silently pass.
  observation_types text[] not null default '{building}'
    check (
      observation_types <@ array['building', 'geotechnical', 'landslide', 'lifeline', 'tsunami', 'emergency_management', 'other']::text[]
      and coalesce(array_length(observation_types, 1), 0) > 0
      and array_position(observation_types, null) is null
    ),
  damage_score smallint check (damage_score between 0 and 5),
  nonstructural_damage boolean not null default false,

  -- Building attributes (only meaningful when observation_types includes 'building')
  building_name text,
  building_type text,
  primary_material text,
  height_class text,
  code_era text,
  failure_mechanism text,
  observed_retrofits text,

  -- AI-assisted fields (scraper/report automation, phase 2+)
  ai_confidence numeric(4, 3),
  ai_model text,

  -- Human review
  status text not null default 'Unverified' check (status in ('Unverified', 'Approved', 'Rejected')),
  engineer_notes text,
  reviewed_by text,
  reviewed_at timestamptz,

  -- Duplicate handling: a merged record stays in the table, hidden but preserved.
  merged_into uuid references public.triage_records (id),

  unique (event_id, external_id)
);

create trigger trg_touch_triage_records_updated_at
  before update on public.triage_records
  for each row execute function public.touch_updated_at();
