-- LLM-assisted geolocation (design doc 2.3). Previously, when Nominatim could
-- not resolve a scraped post's guessed place name, ingest_triage_data.py
-- dropped the post entirely - it never reached a human, even though the
-- design doc calls geolocation "the single biggest drag on the volunteers'
-- time". The script now falls back to Gemini's own direct coordinate guess
-- (from landmark/signage/address recognition in the same vision call already
-- made for damage triage) rather than dropping the post. These are flagged
-- 'ai_estimated' - distinct from 'approximate' - so a human triager knows
-- this location was never confirmed by geocoding a real place name and needs
-- explicit confirmation or correction, not just quiet acceptance.

alter table public.triage_records
  drop constraint triage_records_location_precision_check;
alter table public.triage_records
  add constraint triage_records_location_precision_check
  check (location_precision in ('exact', 'approximate', 'ai_estimated'));

-- Adds p_location_confidence (insert-only, matching how p_location_precision
-- itself is already only set at insert time, never overwritten on re-ingest).
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
  p_location_confidence text default null
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
      ai_confidence, ai_model, source_type, observation_types, location_precision,
      location_confidence
    ) values (
      p_event_id, p_external_id, st_setsrid(st_makepoint(p_lng, p_lat), 4326), p_source_url,
      p_media_url, p_phash, p_region, p_damage_score, p_code_era, p_failure_mechanism,
      p_observed_retrofits, p_ai_confidence, p_ai_model, p_source_type, p_observation_types,
      p_location_precision, p_location_confidence
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
