-- Security hardening from a post-launch review: pins search_path on every
-- remaining SECURITY DEFINER function that was missing it (the pattern
-- established from 0013 onward, e.g. handle_new_user()). Without this, a
-- SECURITY DEFINER function resolves unqualified identifiers using the
-- CALLER's search_path, not a fixed one - if a caller's search_path could
-- ever put an attacker-writable schema ahead of public/pg_catalog, that
-- caller could shadow a table/function the definer relies on. These
-- functions already schema-qualify every reference (public.xxx), so this is
-- defense-in-depth rather than a fix for a demonstrated exploit here - but
-- it's the standard Postgres/Supabase hardening for every SECURITY DEFINER
-- function, cheap to apply, and closes the gap for good. Purely additive:
-- signatures, bodies, and behaviour are unchanged.

create or replace function public.is_event_writer(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.event_members
    where event_id = p_event_id
      and user_id = auth.uid()
      and role in ('admin', 'triager')
  );
$$;

create or replace function public.is_event_member(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.event_members
    where event_id = p_event_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_event_admin(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.event_members
    where event_id = p_event_id and user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.move_observation(
  p_id uuid,
  p_lng double precision,
  p_lat double precision
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
$$;

-- Current (0020) signature/body, just re-declared with search_path pinned.
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
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.is_any_event_writer()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.event_members
    where user_id = auth.uid() and role in ('admin', 'triager')
  );
$$;
