-- Event-scoped equivalents of Kumamoto's submit_observation / move_observation.
-- Both run as security definer (so an authenticated triager can write despite
-- the restrictive base-table RLS in 0010_rls.sql) but check event membership
-- themselves first, since a definer function otherwise bypasses RLS entirely.

create or replace function public.is_event_writer(p_event_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.event_members
    where event_id = p_event_id
      and user_id = auth.uid()
      and role in ('admin', 'triager')
  );
$$ language sql stable security definer;

-- Any role for that event. Also used by RLS policies on event_members itself
-- (0010/0018) - a policy on a table cannot query that same table directly
-- without risking "infinite recursion detected in policy", so those go
-- through this security-definer function instead, which bypasses RLS.
create or replace function public.is_event_member(p_event_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.event_members
    where event_id = p_event_id and user_id = auth.uid()
  );
$$ language sql stable security definer;

-- Admin role specifically for that event (same recursion-avoidance reason).
create or replace function public.is_event_admin(p_event_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.event_members
    where event_id = p_event_id and user_id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

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
  p_height_class text default null
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
    building_type, primary_material, height_class
  ) values (
    p_event_id, st_setsrid(st_makepoint(p_lng, p_lat), 4326), 'human', p_observation_types,
    p_region, p_media_url, p_source_url, p_damage_score, p_code_era, p_failure_mechanism,
    p_observed_retrofits, p_notes, p_submitted_by, p_building_name, p_address,
    p_location_confidence, p_streetview_url, p_building_type, p_primary_material, p_height_class
  )
  returning id into new_id;

  return new_id;
end;
$$ language plpgsql security definer;

create or replace function public.move_observation(
  p_id uuid,
  p_lng double precision,
  p_lat double precision
)
returns void as $$
declare
  target_event uuid;
begin
  select event_id into target_event from public.triage_records where id = p_id;
  if target_event is null then
    raise exception 'record % not found', p_id;
  end if;
  if not public.is_event_writer(target_event) then
    raise exception 'permission denied for event %', target_event;
  end if;

  update public.triage_records
    set geom = st_setsrid(st_makepoint(p_lng, p_lat), 4326)
    where id = p_id;
end;
$$ language plpgsql security definer;

-- Scraper ingestion (phase 2+). Called with the service-role key, which
-- already bypasses RLS, so this only upserts on external_id and protects any
-- field an engineer has already reviewed - it never overwrites a record once
-- it has left 'Unverified'.
create or replace function public.ingest_triage(
  p_event_id uuid,
  p_external_id text,
  p_lng double precision,
  p_lat double precision,
  p_source_url text,
  p_media_url text,
  p_phash text,
  p_region text,
  p_damage_score smallint,
  p_code_era text,
  p_failure_mechanism text,
  p_observed_retrofits text,
  p_ai_confidence numeric,
  p_ai_model text,
  p_source_type text default 'other',
  p_observation_types text[] default '{building}',
  p_location_precision text default 'approximate'
)
returns uuid as $$
declare
  rec_id uuid;
  rec_status text;
begin
  select id, status into rec_id, rec_status
    from public.triage_records
    where event_id = p_event_id and external_id = p_external_id;

  if rec_id is null then
    insert into public.triage_records (
      event_id, external_id, geom, source_url, media_url, phash, region,
      damage_score, code_era, failure_mechanism, observed_retrofits,
      ai_confidence, ai_model, source_type, observation_types, location_precision
    ) values (
      p_event_id, p_external_id, st_setsrid(st_makepoint(p_lng, p_lat), 4326), p_source_url,
      p_media_url, p_phash, p_region, p_damage_score, p_code_era, p_failure_mechanism,
      p_observed_retrofits, p_ai_confidence, p_ai_model, p_source_type, p_observation_types,
      p_location_precision
    )
    returning id into rec_id;
  else
    update public.triage_records set
      geom = st_setsrid(st_makepoint(p_lng, p_lat), 4326),
      source_url = p_source_url,
      media_url = p_media_url,
      phash = p_phash,
      region = p_region,
      ai_confidence = p_ai_confidence,
      ai_model = p_ai_model,
      damage_score = case when rec_status = 'Unverified' then p_damage_score else damage_score end,
      code_era = case when rec_status = 'Unverified' then p_code_era else code_era end,
      failure_mechanism = case when rec_status = 'Unverified' then p_failure_mechanism else failure_mechanism end,
      observed_retrofits = case when rec_status = 'Unverified' then p_observed_retrofits else observed_retrofits end,
      observation_types = case when rec_status = 'Unverified' then p_observation_types else observation_types end
    where id = rec_id;
  end if;

  return rec_id;
end;
$$ language plpgsql security definer;
