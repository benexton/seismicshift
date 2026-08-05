-- The schema is now deployed, so from here on migrations are additive only -
-- no more editing 0001-0019 in place.
--
-- Adds a flexible per-type detail slot: observation_types is multi-select,
-- but only "building" had its own structured fields (name/type/material/
-- height/code era/retrofits) - every other ticked type fell back to the one
-- generic "mechanism / feature" text field. type_details holds small,
-- type-specific structured answers instead, keyed by observation type, e.g.
-- {"lifeline": {"lifeline_type": "power", "service_status": "restored"},
--  "emergency_management": {"activity_type": "evacuation centre"}}.
-- jsonb (not new columns per type) matches the existing pattern on
-- events.basemap/map_center/keyword_sets, and avoids a dozen narrow columns
-- for a vocabulary that is likely to keep evolving.

alter table public.triage_records add column type_details jsonb not null default '{}';

create or replace function public.submit_observation(
  p_event_id uuid,
  p_lng double precision,
  p_lat double precision,
  p_observation_types text[] default '{building}',
  p_region text default null,
  p_media_url text default null,
  p_source_url text default null,
  p_damage_score smallint default null,
  p_code_era text default null,
  p_failure_mechanism text default null,
  p_observed_retrofits text default null,
  p_notes text default null,
  p_submitted_by text default null,
  p_building_name text default null,
  p_address text default null,
  p_location_confidence text default null,
  p_streetview_url text default null,
  p_building_type text default null,
  p_primary_material text default null,
  p_height_class text default null,
  p_type_details jsonb default '{}'
)
returns uuid as $$
declare
  new_id uuid;
begin
  if not public.is_event_writer(p_event_id) then
    raise exception 'permission denied for event %', p_event_id;
  end if;

  insert into public.triage_records (
    event_id, geom, source_type, observation_types, region, media_url, source_url,
    damage_score, code_era, failure_mechanism, observed_retrofits, engineer_notes,
    submitted_by, building_name, address, location_confidence, streetview_url,
    building_type, primary_material, height_class, type_details
  ) values (
    p_event_id, st_setsrid(st_makepoint(p_lng, p_lat), 4326), 'human', p_observation_types,
    p_region, p_media_url, p_source_url, p_damage_score, p_code_era, p_failure_mechanism,
    p_observed_retrofits, p_notes, p_submitted_by, p_building_name, p_address,
    p_location_confidence, p_streetview_url, p_building_type, p_primary_material, p_height_class,
    coalesce(p_type_details, '{}'::jsonb)
  )
  returning id into new_id;

  return new_id;
end;
$$ language plpgsql security definer;
