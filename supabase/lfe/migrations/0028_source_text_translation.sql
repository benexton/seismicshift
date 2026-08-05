-- Auto-translation at ingest (design doc 2.4). The scraped post's own
-- caption/text was never actually stored anywhere - ingest_triage_data.py
-- used it only ephemerally to build the AI triage prompt, then discarded it,
-- so a triager who doesn't read the event's local language had no way to
-- work a record short of clicking through to the original post and
-- translating it themselves. These two columns store the original text and
-- an English translation (same value as source_text when the AI judged it
-- already English), both produced by the same Gemini/OpenAI call already
-- made for damage triage - no second LLM call per item.

alter table public.triage_records add column source_text text;
alter table public.triage_records add column source_text_en text;

-- Adds p_source_text/p_source_text_en (insert-only for the raw text, and
-- protected from re-ingest overwrite once a human has reviewed the record -
-- same pattern as the other AI-set fields on this function).
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
$$ language plpgsql security definer;
