# Claude Code scope: multi-event LFE VERT platform

A hand-off brief for building the reusable Learning from Earthquakes (LfE) platform on top of the existing `seismicshift` repo. Read this together with `VERT_platform_design.md`, which has the reasoning; this document is the actionable scope, constraints, and phased plan.

---

## 0. The single most important constraint

**The new platform uses a brand-new, separate Supabase project. The existing Kumamoto project, its data, and its two live URLs must not be touched.**

Because the platform lives in a different database, Kumamoto is isolated by construction. There is no backfill, no shared schema, and no shared row-level security. Concretely:

- The existing pages `/kumamoto-triage-2026/` and `/kumamoto-2026-public/` and every file they depend on keep working exactly as they do today, pointing at the old project. Prefer leaving those files unchanged entirely.
- The new platform is greenfield in the new project, served from new `/lfe/*` routes, using a new Supabase client and new environment variables and new GitHub Actions secrets.
- If a shared/presentational component is reused by both the Kumamoto pages and the new pages, it must be changed in a backward-compatible way so the Kumamoto runtime behaviour is byte-for-byte unchanged (defaults preserve current behaviour). If that cannot be guaranteed cleanly, duplicate rather than risk Kumamoto.

Acceptance test for every change: the Kumamoto triage tool and public page behave identically before and after. Ideally their files show no diff.

---

## 1. Context

`seismicshift` is an Astro static site on GitHub Pages (repo `benexton/seismicshift`, working clone `C:\GitHub\seismicshift`, Windows/PowerShell, VS Code). The current single-event Kumamoto tool is: one `client:only` React island per page, react-leaflet maps on GSI Japan tiles, Supabase (Postgres, PostGIS, Auth email/password, Storage, Realtime), and GitHub Actions for a Bluesky/RSS scraper, a Google Sheets backup, a Gemini report-conclusions job, and a public snapshot export. Everything is currently hardcoded to one event (Kumamoto): the event details live in a single `event_meta` row, `triage_records` have no event field, and the basemap, map centre, and scraper keywords are baked in.

The goal is a platform where LfE can spin up an event in minutes, provision volunteers to it, run the pipeline, and publish a public view, with a public page that lets anyone pick between events.

---

## 2. Golden rules (house style and process)

- **Kumamoto untouched** (rule 0 above).
- **New Supabase project** for all platform data, auth, storage, and Actions.
- Every change is additive to the repo: new files and new `/lfe/*` routes.
- `npm run build` must pass before any commit. Work branch-by-branch off `main`; never push straight to the branch GitHub Pages deploys until a slice is verified.
- Run schema changes as ordered, checked-in SQL migration files against the new project, and run them before deploying the frontend that reads the new columns.
- **No em dashes or en dashes anywhere** (code, comments, docs, UI copy). Use hyphens. Grep each deliverable to confirm.
- **New Zealand conventions**: dates dd/mm/yyyy in any UI or generated output (a helper already exists as `fmtDate`).
- Match the existing code style (React function components, small modules, Supabase JS client, minimal dependencies). Reuse existing presentational components where it does not risk Kumamoto.
- After any edit that adds a shared helper, scan for "used but not imported" before building (a white-screen ReferenceError bit us before; the build does not catch it).

---

## 3. Environment and prerequisites

- **New Supabase project** created by the owner. Note its URL, anon key, and service-role key.
- **Frontend env (build-time, `PUBLIC_` so Astro exposes them):**
  - Keep the existing `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` for the Kumamoto pages, unchanged.
  - Add `PUBLIC_LFE_SUPABASE_URL` and `PUBLIC_LFE_SUPABASE_ANON_KEY` for the new project.
- **Actions secrets (new project):** `LFE_SUPABASE_URL`, `LFE_SUPABASE_SERVICE_ROLE_KEY`. Reuse existing `LLM_API_KEY`, `BLUESKY_IDENTIFIER`, `BLUESKY_APP_PASSWORD`, `NOMINATIM_UA` as needed. The existing Kumamoto Actions and their secrets are left as-is.
- **Storage:** create the new project's public bucket for media and public snapshots (mirror the existing `observation-media` conventions).
- A new Supabase client module (for example `src/lib/supabaseLfe.js`) built from the `PUBLIC_LFE_*` vars. Do not modify the existing `src/lib/supabase.js`.

Note: product setup details for Claude Code, Node version, and Supabase specifics change over time; verify current requirements from the official docs rather than assuming.

---

## 4. Target architecture

### 4.1 Data model (new project, greenfield)

Proposed as a starting point; refine as sensible, but keep the shape.

- `events`: `id` uuid pk, `slug` text unique (used in URLs), `name`, `country`, `country_code`, `event_datetime` timestamptz, `epicentre_lat`/`epicentre_lng`, `usgs_event_id` text null, `languages` text[], `basemap` jsonb (preset name or `{url, attribution}`), `map_center` jsonb (`{lat,lng,zoom}`), `keyword_sets` jsonb (per language), `status` text check in (`draft`,`active`,`archived`) default `draft`, `is_public` boolean default false, `created_by` uuid, `created_at` timestamptz default now(). Report/characteristics fields (magnitude, depth, MMI, faulting, tsunami, contributors, `conclusions_md`, `report_generated_at`, `report_generated_by`) can live here or in a per-event `event_meta` keyed by `event_id`; pick one and be consistent.
- `event_members`: `event_id` fk -> events, `user_id` uuid (auth.users), `role` text check (`admin`,`triager`,`viewer`), pk (`event_id`,`user_id`).
- `triage_records`: mirror the current schema (PostGIS `geom`, generated lat/long, all the descriptive and classification columns including `nonstructural_damage`, `merged_into`, provenance fields) plus `event_id` uuid fk -> events not null. Decide site numbering: prefer a per-event sequential `site_number` (nicer for reports like "Site #155") assigned by a small function/trigger now that DDL permissions are restored; a global identity is the simpler fallback.
- `record_attachments`: as current (`record_id` fk, `media_url`, `source_url`, `file_url`, `file_name`, `note`, `added_by`), event inherited via the record.

### 4.2 Row-level security

- `triage_records` and `record_attachments`: a member can select/insert/update rows for events they belong to (`event_id in (select event_id from event_members where user_id = auth.uid())`); admins additionally as needed. No anon access (the public view uses static snapshots, below).
- `events`: readable by members; created/updated by admins.
- `event_members`: managed by event admins; user provisioning that needs the auth admin API runs server-side (service role) via an Action or Edge Function, never from the browser.
- Design and test RLS carefully; this is the security boundary between events.

### 4.3 Frontend routing (static host, runtime events)

Events are created at runtime, so pages are event-agnostic and read the event slug from the URL, loading that event's config from the new project at load time.

- `/lfe/` - login and landing; after auth, list the events the user is a member of and link into each.
- `/lfe/triage/?event=<slug>` - the triage workstream, scoped to that event.
- `/lfe/public/` - public viewer with an event dropdown (or `?event=<slug>`), reading per-event static snapshots.
- `/lfe/admin/` - admin setup page (section 4.5), visible only to admins.

Start with query-parameter routing (no per-event rebuild needed). Pretty paths (`/lfe/japan-2026/`) are optional later via a build-time events list or a catch-all. The existing Kumamoto routes are separate and untouched.

### 4.4 Per-event configuration drives the pipeline

- The map reads `basemap`, `map_center`, and `epicentre` from the event, instead of hardcoded Japan values (support at least a GSI-Japan preset and a global default such as OpenStreetMap or Esri World Imagery).
- The scraper Action is event-parameterised: it takes an event slug (or loops active events), reads `keyword_sets` and sources, and writes into that `event_id`.
- Report generation and public export run per event and write per-event snapshots (`public/<slug>.json` in the new project's public bucket). The public dropdown lists public events and loads the selected snapshot.

### 4.5 Admin setup and mobilisation

`/lfe/admin/` (admins only) creates an event: name, country, datetime, epicentre, or a USGS event id to auto-fill characteristics later (phase 3). Pick basemap preset, confirm languages, review auto-generated keyword seeds (a canonical English earthquake/damage term list auto-translated into the home language via Gemini, plus place names and hashtags), set sources, then assign initial users. On save it creates the event and metadata, seeds the scraper config, prepares the snapshot path, and flips `draft -> active`.

---

## 5. Phased plan with acceptance criteria

Deliver in slices. Each slice is a branch that builds and is verified before merge.

### Phase 1 - Foundation

1. New Supabase client module from `PUBLIC_LFE_*`; new env vars documented.
2. Migration files (checked into `supabase/lfe/` or similar) creating `events`, `event_members`, `triage_records`, `record_attachments`, PostGIS setup, and RLS policies in the new project. Include a seed for a throwaway test event.
3. `/lfe/` login + landing listing the user's events (from `event_members`).
4. `/lfe/triage/?event=<slug>`: an event-scoped triage view reusing the map/cluster/filter/table/review components, reading config and data for that event from the new client. Manual entry, triage queue, and triaged map working against the new project.

Acceptance: a test user provisioned to a test event can log in at `/lfe/`, open the event, add a manual observation, and see it on the map, all in the new project. Kumamoto pages unchanged and still working.

### Phase 2 - Setup and mobilisation

1. `/lfe/admin/` create-event page (with keyword auto-translation) and user provisioning via a service-role path.
2. Event-parameterise the scraper, report, and public-export Actions against the new project (new secrets); per-event snapshots.
3. `/lfe/public/` with the event dropdown reading per-event snapshots.

Acceptance: an admin creates a fresh event end to end, assigns a user, the scraper populates it, and it appears on the public dropdown.

### Phase 3 - Automation for quality

USGS auto-pull (characteristics + shakemap/PGA/liquefaction/landslide figures), auto references, auto-translation at ingest, LLM-assisted geolocation, the report taxonomy plus fuller AI-drafted sections, the per-country code library, and the social-impact digest. Each is an independent add-on; see the design doc for detail.

### Phase 4 - Polish

Scheduling, per-event dashboards, an Edge Function for true one-click report/regenerate, and duplicate/quality automation.

---

## 6. Testing and validation

- `npm run build` passes for every slice; fix any "used but not imported" before building.
- Verify RLS actually isolates events: a member of event A cannot read or write event B (test with two users/events).
- Confirm the two Supabase clients never cross: the Kumamoto pages only ever hit the old project, the `/lfe/*` pages only the new one.
- Dash-check and dd/mm/yyyy-check each deliverable.
- Test the migrations on the new project in order; keep them reversible where practical.

---

## 7. Out of scope / do not touch

- The old Supabase project and all Kumamoto data.
- `/kumamoto-triage-2026/` and `/kumamoto-2026-public/` and, ideally, every file they import. `src/lib/supabase.js` stays as-is.
- The existing Kumamoto GitHub Actions and their secrets.
- Marketing pages and the main site layout.

---

## 8. Open decisions to confirm with the owner

- **Site numbering:** per-event sequential (recommended, needs a small function/trigger) versus a global identity.
- **Report/characteristics storage:** on the `events` row versus a per-event `event_meta` table.
- **URL style:** query parameters now versus pretty per-event paths later.
- **Kumamoto in the new platform:** leave Kumamoto solely on its existing routes/project (default), or optionally one-way import a read-only copy into the new project as a demo event (reads old, writes new, never modifies old). Recommend leaving it out initially and validating with a fresh test event.
- **Auth:** whether platform users are a fresh user base in the new project (default) and how admins are granted.

---

## 9. First task for Claude Code

Read `VERT_platform_design.md` and this scope. Confirm the open decisions in section 8 with the owner. Then start Phase 1: stand up the new Supabase client and env, write and run the schema + RLS migrations against the new project with a seed test event, and build the `/lfe/` login/landing plus an event-scoped `/lfe/triage/` view, all without changing anything in the Kumamoto path. Keep it on a branch, make the build pass, and demonstrate the Phase 1 acceptance test before merging.
