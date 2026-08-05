-- What the scraper pipeline watches, per event. Kumamoto's own scraper_sources
-- table has no event column at all (single-tenant) - this is a fresh table.

create table public.scraper_sources (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  kind text not null check (kind in ('bluesky', 'rss')),
  value text not null,
  enabled boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);

create index idx_scraper_sources_event_id on public.scraper_sources (event_id);
