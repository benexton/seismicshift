-- One-time-import support: submit_observation/ingest_triage can't express a
-- faithful historical copy (they force status='Unverified'/source_type
-- fixed, never accept an explicit site_id, reviewed_by/reviewed_at, or a
-- created_at in the past). This RPC accepts the full record shape so
-- scripts/lfe/import_kumamoto_demo.py can recreate Kumamoto's existing
-- records - including their original site numbers and review state - in a
-- brand-new event, without ever writing back to Kumamoto's own project.
--
-- Restricted to the service_role JWT claim, not is_platform_admin(): a
-- service-role caller has no auth.uid() (no user session), so
-- is_platform_admin() would always evaluate false for it. Checking
-- auth.role() directly is also what keeps this from being callable by an
-- ordinary authenticated user, who could otherwise spoof reviewed_by/status
-- on arbitrary records via this function (security definer bypasses RLS).

create or replace function public.import_triage_record(
  p_event_id uuid,
  p_site_id integer,
  p_lng double precision,
  p_lat double precision,
  p_created_at timestamptz default null,
  p_source_type text default 'human',
  p_submitted_by text default null,
  p_external_id text default null,
  p_source_url text default null,
  p_media_url text default null,
  p_phash text default null,
  p_streetview_url text default null,
  p_location_precision text default 'exact',
  p_location_confidence text default null,
  p_region text default null,
  p_address text default null,
  p_observation_types text[] default '{building}',
  p_damage_score smallint default null,
  p_nonstructural_damage boolean default false,
  p_building_name text default null,
  p_building_type text default null,
  p_primary_material text default null,
  p_height_class text default null,
  p_code_era text default null,
  p_failure_mechanism text default null,
  p_observed_retrofits text default null,
  p_ai_confidence numeric default null,
  p_ai_model text default null,
  p_status text default 'Approved',
  p_engineer_notes text default null,
  p_reviewed_by text default null,
  p_reviewed_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'permission denied - service_role only';
  end if;

  insert into public.triage_records (
    event_id, site_id, created_at, source_type, submitted_by, external_id,
    source_url, media_url, phash, streetview_url, location_precision,
    location_confidence, region, address, observation_types, damage_score,
    nonstructural_damage, building_name, building_type, primary_material,
    height_class, code_era, failure_mechanism, observed_retrofits,
    ai_confidence, ai_model, status, engineer_notes, reviewed_by, reviewed_at,
    geom
  ) values (
    p_event_id, p_site_id, coalesce(p_created_at, now()), p_source_type, p_submitted_by, p_external_id,
    p_source_url, p_media_url, p_phash, p_streetview_url, p_location_precision,
    p_location_confidence, p_region, p_address, p_observation_types, p_damage_score,
    p_nonstructural_damage, p_building_name, p_building_type, p_primary_material,
    p_height_class, p_code_era, p_failure_mechanism, p_observed_retrofits,
    p_ai_confidence, p_ai_model, p_status, p_engineer_notes, p_reviewed_by, p_reviewed_at,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- Lets the import script fix up a record's merged_into to point at the NEW
-- id of its merge target (the old ids don't exist in this project), and
-- lets it seed the per-event site-number counter to continue after the
-- highest imported site_id, so the next manually-submitted observation in
-- this event doesn't collide with an imported number.
create or replace function public.import_set_merged_into(p_id uuid, p_merged_into uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'permission denied - service_role only';
  end if;
  update public.triage_records set merged_into = p_merged_into where id = p_id;
end;
$$;

create or replace function public.import_seed_site_counter(p_event_id uuid, p_next_number integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'permission denied - service_role only';
  end if;
  insert into public.event_site_counters (event_id, next_number)
  values (p_event_id, p_next_number)
  on conflict (event_id) do update set next_number = greatest(event_site_counters.next_number, p_next_number);
end;
$$;
