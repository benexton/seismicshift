-- Adds 'twitter' as a third scraper source kind, alongside 'bluesky' and
-- 'rss', now that a paid X API plan makes search-based collection possible
-- the same way Bluesky's already works.

alter table public.scraper_sources
  drop constraint scraper_sources_kind_check;
alter table public.scraper_sources
  add constraint scraper_sources_kind_check
  check (kind in ('bluesky', 'rss', 'twitter'));

alter table public.triage_records
  drop constraint triage_records_source_type_check;
alter table public.triage_records
  add constraint triage_records_source_type_check
  check (source_type in ('human', 'bluesky', 'rss', 'twitter', 'other'));
