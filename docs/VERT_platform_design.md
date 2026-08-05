# VERT: from a Kumamoto build to a reusable LFE capability

A design and roadmap for turning the current single-event triage tool into a platform NZSEE's Learning from Earthquakes (LfE) group can mobilise for any future event, plus the automation that would cut the manual effort seen in the Japan 2026 report while keeping the output quality members expect.

This is a planning document, not a change to the live system. Nothing here touches the two Kumamoto URLs or their data; all new work lands on standalone routes and is additive.

---

## 1. What the Japan report tells us about where the effort went

Reading the V1.3 report end to end, the human effort concentrated in a handful of predictable places. That is good news, because predictable work is automatable work.

- **Event characteristics and the standard hazard figures.** The front-matter table (magnitude, depth, location, faulting mechanism, MMI, tsunami) and Figures 1, 3, 8, 11 and 14 (epicentre/shaking intensity, tectonic setting, PGA, response spectra context, liquefaction susceptibility) were assembled by hand from USGS, JMA, GSI and NIED. Almost all of this exists behind stable, free APIs.
- **Social impacts.** Casualties, displaced persons, evacuation centres, water and power outages were gathered from prefectural government PDFs and news. USGS PAGER alone gives automated fatality and economic loss estimates for any significant global event.
- **Geolocation.** Explicitly a bottleneck. Some verified sites could not be located and were given placeholder water coordinates. This is the single biggest drag on the volunteers' time.
- **References.** The report carries well over one hundred citations, each a manually captured link with a retrieval date. Your tool already stores a source URL on every observation.
- **The narrative itself.** The prose is organised by ground effect, then by building occupancy (commercial, industrial, historical, public, residential), then by lifeline type (bridges, roads, rail, ports, water, power). Much of it restates, in words, what the underlying observations already encode, plus a per-country policy section that is genuinely reusable.

The through-line: a large fraction of the report is either (a) standard hazard data any global event has, (b) a structured restatement of observations you already hold, or (c) reusable per-country context. All three are strong automation targets.

---

## 2. Automation opportunities (minimise effort, protect quality)

Ordered roughly by value for effort. Each is an independent add-on, so they can be shipped one at a time without disturbing anything else.

### High value

**2.1 Auto-pull event characteristics and hazard figures from USGS.**
Given a USGS event id (or lat/long plus time), fetch magnitude, depth, location, origin time, focal mechanism, the tectonic/region summary text, the ShakeMap intensity image, PGA/PGV/PSA layers, and the Ground Failure products (liquefaction and landslide) with their images. This auto-fills the characteristics table and supplies several of the report's standard figures. USGS is global and stable, so this generalises to any future event, with JMA/GSI/GeoNet layered in per country where available. This alone removes a large, dull chunk of the front matter.

**2.2 Auto-compile the references appendix.**
Every observation and attachment already carries a source URL. Generate a numbered, de-duplicated references list with retrieval dates as part of report generation. Low effort, high relief.

**2.3 LLM-assisted geolocation.**
For posts with an image or text but no location, use Gemini (vision plus text) to propose coordinates, from landmark or signage recognition, address extraction, and cross-referencing Street View, returning a candidate with a confidence score for a human to confirm or reject. This attacks the geolocation bottleneck directly and should shrink the "could not locate" set that currently ends up on water coordinates.

**2.4 Auto-translation at ingest.**
Translate scraped posts from the event's home language into English when they are ingested (store both), so triagers who do not read the language can still work and the AI commentary comes out in English. This widens the volunteer pool and speeds triage, and it is a small addition to the Gemini step you already run.

**2.5 Report taxonomy aligned to the LfE structure.**
Add a few optional fields so each observation maps cleanly onto the report's sections: occupancy class (commercial / industrial / historical / public / residential), ground-effect subtype (liquefaction / fault rupture / landslide / foundation / coastal-riverbank), lifeline subtype (bridge / road / rail / port / water / power), a good-performance flag, and a retrofit-observed flag. This is additive and low cost, and it is what makes the next item almost free.

**2.6 Fuller AI-drafted report sections.**
Extend the report generator so Gemini drafts the full set of standard sections (introduction, social impacts, seismotectonic setting, each ground-effect category, building performance by occupancy, good performance, and infrastructure/lifelines) from the verified observations grouped by the taxonomy above, plus the USGS products from 2.1 and a per-country code snippet from 2.7. You keep the author placeholders for judgement and figures, but the blank-page problem largely disappears.

### Medium value

**2.7 Per-country seismic-code and retrofit knowledge base.**
The Japan section on the 1995 Retrofit Act, the 1981 and 2000 thresholds, and the retrofit statistics is high quality and entirely reusable for the next Japanese event, and the same pattern applies to New Zealand, Venezuela (COVENIN), and so on. Build a small curated library keyed by country that the report generator can insert and lightly adapt. It compounds in value as events accrue.

**2.8 Automated social-impact digest.**
A pipeline that watches official and humanitarian sources (prefectural or civil-defence releases, USGS PAGER, ReliefWeb, GDACS) and drafts the social-impacts section with citations for human verification.

**2.9 Figure and caption assembly, including before/after pairs.**
Auto-select a representative figure per section, auto-caption from the observation data with source attribution, and automatically pair a pre-event Street View with a post-event photo where both exist (the report leans heavily on before/after comparisons).

**2.10 Duplicate and quality automation.**
You already have perceptual-hash de-duplication. Extend it with LLM near-duplicate detection (same building, different post), auto-clustering of likely duplicates for a reviewer, and automatic flagging of out-of-area or low-confidence entries.

### Operational polish

**2.11 Scheduling, dashboards, and one-click actions.**
Move the scraper, report draft, and public snapshot to schedules per active event so they are not triggered by hand, add a per-event dashboard (counts, last run, pending review), and provide a true one-click regenerate via a small Supabase Edge Function that holds the key server-side (the clean version of the button we removed).

---

## 3. The multi-event platform

Today the app is single-event and Japan-specific: one event's details live in a single `event_meta` row, records have no event field, the basemap and map centre and keywords are baked in, and the routes name Kumamoto directly. The platform change is to make the **event** the top-level entity that everything hangs off, and to make the frontend event-agnostic.

### 3.1 Data model

Introduce an `events` table as the parent:

- `events`: id, **slug** (used in URLs, e.g. `japan-2026`), name, country and country code, event datetime, epicentre lat/long, optional USGS event id, languages, basemap preset (or explicit tile URL and attribution), map centre and default zoom, keyword sets per language, status (`draft` / `active` / `archived`), `is_public`, created_by.
- Add an `event_id` foreign key to `triage_records` (attachments inherit it through their record). Make `event_meta` per-event (add `event_id`, drop the single-row assumption), or fold event metadata into the `events` row.

**Kumamoto stays exactly as it is.** The migration creates the table, inserts one `kumamoto-2026` event, backfills every existing record to it, and migrates the existing `event_meta`. No data moves or is lost, and the current routes keep working against that event. New events simply get new rows.

### 3.2 Provisioning and access

- `event_members`: (event_id, user_id, role = `admin` / `triager` / `viewer`).
- Row-level security scopes reads and writes so a triager only sees and edits records for events they belong to, and admins can manage the event and its members. This is what "provision users to an event" means in practice, and it enforces it at the database, not just the UI.
- An LfE landing page after login lists the events a user is assigned to and drops them into that event's workstream.

### 3.3 Frontend routing on a static host

The site is static (Astro on GitHub Pages) and events are created at runtime, so the pages must be event-agnostic and load an event's configuration from Supabase at load time, keyed by the slug in the URL.

- `/lfe/` - landing and login; lists the user's assigned events.
- `/lfe/triage/?event=<slug>` - the triage workstream, scoped to that event.
- `/lfe/public/?event=<slug>` or `/lfe/public/` with an event dropdown - the public viewer.

Query-parameter routing needs no per-event rebuild and is the simplest start. Pretty paths like `/lfe/japan-2026/` can be added later either by rebuilding the static site when an event is created (an Action reading the events list at build time) or with a catch-all fallback. I would start with query parameters and only add pretty paths if they matter for sharing.

**The existing Kumamoto routes are left untouched** and continue to serve the public and the volunteer team. All of the above is new, standalone, and additive.

### 3.4 Per-event configuration drives the pipeline

Once configuration lives on the event row, the same code serves every event:

- The **map** reads the basemap preset (GSI for Japan, OpenStreetMap or Esri World Imagery elsewhere), centre, zoom, and epicentre for distance ranking, instead of the hardcoded Japan values.
- The **scraper** becomes event-parameterised: it loops over active events (or takes a slug), reads that event's keyword sets and sources, and writes into that `event_id`.
- **Report generation** and the **public export** run per event and write per-event snapshots (`public/<slug>.json`), so the public dropdown can offer any public event.

---

## 4. Setup and mobilisation

The goal you described: if LfE decides to mobilise, setup should take minutes, not a rebuild.

### 4.1 Admin setup page (LfE admins only)

Create an event by entering name, country, event datetime, and epicentre, or by pasting a **USGS event id** to auto-fill magnitude, depth, location, epicentre, MMI and mechanism, and to pull the standard hazard figures (2.1). The admin picks the basemap preset (auto-suggested from the country), confirms languages, reviews auto-generated keyword seeds (below), and sets the sources. On save the system creates the event and its metadata, seeds the scraper configuration, provisions the initial users, and prepares the public snapshot path. The event moves `draft -> active`, assigned volunteers start triaging, the scheduled scraper and Gemini runs kick in, and the public snapshot publishes.

### 4.2 Keyword generation in the home language

Keep a canonical English list of earthquake and damage terms (earthquake, collapse, damage, liquefaction, landslide, crack, fire, evacuation, building, bridge, road, and so on). On event creation, auto-translate it into the event's language(s) with Gemini and add event-specific terms (place names, event hashtags). This removes the manual keyword crafting that currently has to be done per event and per language, and it stores the result on the event so it is editable.

### 4.3 Lifecycle

`draft` for setup, `active` once mobilised, `archived` when the report is done, keep the public view live but stop scraping. Provisioning follows the event, so standing down a team is just changing memberships.

---

## 5. Protecting the Kumamoto work, and one prerequisite

**Kumamoto is ring-fenced.** Both existing URLs and all their data are left as they are. The multi-event tables are created alongside, the existing records are backfilled to a Kumamoto event without moving, and the new `/lfe/*` routes are entirely separate. If you ever want to, you can later point Kumamoto at the generic routes, but nothing forces that.

**The one hard prerequisite is the Supabase schema-permission issue.** Several times during the build, `CREATE FUNCTION` and `CREATE POLICY` failed with "permission denied for schema public" (this is why merge runs client-side, why deleting existing attachments needs an optional migration, and why the one-click report regenerate was awkward). The multi-event model needs new tables and new row-level-security policies, which is exactly that class of statement. So step zero is to get Supabase to restore the default privileges on the public schema (a support request). It unblocks the platform work and quietly fixes the earlier rough edges at the same time. Adding columns has always worked, so the parts that are only new columns can proceed regardless, but tables and policies need this resolved.

---

## 6. Suggested sequencing

**Phase 1 - Foundation.** Resolve the Supabase permissions. Create `events` and `event_members`; backfill Kumamoto; add row-level security scoping. Build the `/lfe/` login and landing that lists a user's events, and a generic event-scoped triage page. Kumamoto routes untouched throughout. Test end to end with a throwaway event.

**Phase 2 - Setup and mobilisation.** The admin create-event page with USGS auto-fill and translated keyword seeds; event-parameterise the scraper, report, and public export; per-event public snapshots and the public dropdown page.

**Phase 3 - Automation for quality.** USGS hazard auto-pull into metadata and figures; auto references; auto-translation at ingest; LLM-assisted geolocation; the report taxonomy plus the fuller AI sections; the per-country code library; the social-impact digest.

**Phase 4 - Polish.** Scheduling, dashboards, the Edge Function one-click, and the duplicate/quality automation.

Phases 1 and 2 make LfE able to mobilise any event quickly. Phase 3 is where the report-writing effort really drops. Phase 4 is quality of life.

---

## 7. Risks and decisions to make

- **Supabase permissions** are the gating item; everything with new tables or policies waits on it.
- **Data safety during the migration.** The backfill must be additive and reversible, and Kumamoto must be verifiably isolated. Test on a copy first.
- **Static hosting versus dynamic events.** Query-parameter routing avoids rebuilds; pretty per-event paths cost a rebuild step. Decide how much the URL aesthetics matter.
- **Copyright and sensitivity at scale.** Republishing photographs and precise locations of damaged buildings, sourced from social media, across many countries is a governance question, not just a technical one. The disclaimers help, but this needs an NZSEE-endorsed policy on attribution, on publishing precise locations, and on takedown requests before the platform is opened to arbitrary events.
- **Source reliability, rate limits, and caching** for USGS/JMA/GeoNet products.
- **Cost.** Gemini usage and Supabase tier scale with the number of events and volume; worth sizing before a busy season.
- **Governance.** Who may create events and provision users, and how the LfE admin role is granted and revoked.

---

## 8. The shape of it, in one paragraph

Make the event the top-level object, scope users and data to events with row-level security, and serve every event from one event-agnostic set of pages that read their configuration from the database. Give LfE an admin page that spins up an event in minutes, seeded from a USGS event id and auto-translated keywords, and a public page with an event dropdown. Then layer in the automation that the Japan report shows would help most: pull the standard hazard data and figures automatically, translate and help geolocate at ingest, capture observations against the report's own taxonomy, and let Gemini draft the whole narrative from that structured base while members keep judgement and figures. Keep Kumamoto exactly as it is throughout, and treat the Supabase permission fix as the first task, because the rest of the platform depends on it.
