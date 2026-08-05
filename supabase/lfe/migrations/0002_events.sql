-- The top-level entity everything else hangs off. One row per earthquake event.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  country text,
  country_code text,
  event_datetime timestamptz,
  epicentre_lat double precision,
  epicentre_lng double precision,
  usgs_event_id text,
  languages text[] not null default '{}',
  -- basemap: {"key": {"label": "...", "url": "...", "attribution": "..."}, ...}
  basemap jsonb not null default '{}',
  -- map_center: {"lat": 0, "lng": 0, "zoom": 10}
  map_center jsonb not null default '{}',
  -- keyword_sets: {"en": ["earthquake", ...], "ja": [...], ...}
  keyword_sets jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  is_public boolean not null default false,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
