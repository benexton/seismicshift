# LFE platform migrations

Run these against the new, separate LFE Supabase project only - never against
the Kumamoto project. Run in numeric order (`0001` through `0031`), e.g. via
the Supabase SQL editor or `supabase db push`. `0021` and `0022` are security
fixes from a post-launch review (a client-writable report-conclusions column
and an overly broad storage policy) - run them even if `0001`-`0020` are
already live on your project. `0023` adds the RPCs used by
`scripts/lfe/import_kumamoto_demo.py` (see that script's docstring) - only
needed if you want to import a read-only copy of Kumamoto's existing data as
a new event. `0024` backfills `profiles` for any account created before the
`handle_new_user()` trigger existed (fixes the admin UI showing a raw user id
instead of an email), adds display names, and adds platform-wide admin
grant/revoke. `0025` makes every platform admin an admin member of every
event (existing events, backfilled once; future events and future admins,
kept in sync automatically). `0026` adds an `ai_estimated` location precision
and a location-confidence param to `ingest_triage()`, for the scraper
pipeline's LLM-assisted geolocation fallback (see
`scripts/lfe/ingest_triage_data.py`). `0027` defaults `event_meta.version`
to '1.0' and backfills existing rows, so the report generator's version
field starts populated instead of blank. `0028` adds `source_text`/
`source_text_en` columns and matching `ingest_triage()` params, for the
scraper pipeline's auto-translation at ingest (see
`scripts/lfe/ingest_triage_data.py`). `0029` is a security fix from a
post-launch review - `event_site_counters` had never had row-level
security enabled (unlike every other table in this schema), letting any
authenticated user read or overwrite any event's site-numbering counter;
run it even if `0001`-`0028` are already live. `0030` adds `country_codes`/
`country_code_entries` - the platform-wide seismic-code/retrofit knowledge
base at `/lfe/codes/`, readable by any logged-in user and editable by any
triager/admin on any event. `0031` is a one-time seed of that knowledge base
with real Venezuela and Japan content drawn from the NZSEE VERT Venezuela
and Kumamoto reports - run once only, it is not idempotent.

After running them:
1. Create a real user in that project's Auth dashboard.
2. Fill in and run the placeholder inserts at the bottom of
   `0011_seed_test_event.sql` (event_members admin row for the seeded test
   event, and a platform_admins row so that user can also create new events
   and provision others via `/lfe/admin/`).
3. Deploy the `translate-keywords` Edge Function under `supabase/functions/`
   and set its `LLM_API_KEY` secret (see that folder's README) if you want the
   admin UI's keyword auto-translation to work.
