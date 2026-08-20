-- Security fix: ingest_triage() was missing the service_role check every
-- sibling RPC has (import_triage_record, import_set_merged_into,
-- import_seed_site_counter in 0023; submit_observation elsewhere). As a
-- SECURITY DEFINER function it bypasses RLS entirely, so without this check
-- any authenticated user of any event could call it directly
-- (supabase.rpc('ingest_triage', {...})) with an arbitrary p_event_id and
-- write/overwrite triage_records in every other event. Only the scraper
-- pipeline (scripts/lfe/ingest_triage_data.py, using the service-role key)
-- calls this RPC, so restricting it to service_role matches actual usage.

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
  p_location_precision text default 'approximate',
  p_location_confidence text default null,
  p_source_text text default null,
  p_source_text_en text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rec_id uuid;
  rec_status text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'permission denied - service_role only';
  end if;

  select id, status into rec_id, rec_status
    from public.triage_records
    where event_id = p_event_id and external_id = p_external_id;

  if rec_id is null then
    insert into public.triage_records (
      event_id, external_id, geom, source_url, media_url, phash, region,
      damage_score, code_era, failure_mechanism, observed_retrofits,
      ai_confidence, ai_model, source_type, observation_types, location_precision,
      location_confidence, source_text, source_text_en
    ) values (
      p_event_id, p_external_id, st_setsrid(st_makepoint(p_lng, p_lat), 4326), p_source_url,
      p_media_url, p_phash, p_region, p_damage_score, p_code_era, p_failure_mechanism,
      p_observed_retrofits, p_ai_confidence, p_ai_model, p_source_type, p_observation_types,
      p_location_precision, p_location_confidence, p_source_text, p_source_text_en
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
      observation_types = case when rec_status = 'Unverified' then p_observation_types else observation_types end,
      source_text = case when rec_status = 'Unverified' then p_source_text else source_text end,
      source_text_en = case when rec_status = 'Unverified' then p_source_text_en else source_text_en end
    where id = rec_id;
  end if;

  return rec_id;
end;
$$;
