-- Closes a real, previously-missed gap: event_site_counters has never had
-- row-level security enabled, unlike every other table in this schema
-- (events, event_meta, event_members, triage_records, record_attachments,
-- scraper_sources, profiles, platform_admins all do). Without RLS, any
-- authenticated user - a triager on Event A, say - could read or directly
-- overwrite ANY event's next_number via the auto-generated REST API,
-- including one they have no membership in at all. Writing an arbitrary
-- value there doesn't corrupt triage_records itself, but it can make a
-- future genuine insert in a target event collide with an existing site_id
-- (there is no unique constraint on (event_id, site_id) - the counter is the
-- only thing keeping numbers from repeating), confusing the "Site #N"
-- numbering used throughout the review UI and reports for an event the
-- tampering user has no relationship to.
--
-- assign_site_id() is not security definer, so it runs as the invoking
-- user - enabling RLS with zero policies would also block its own internal
-- upsert for ordinary triagers/admins, breaking every future submission.
-- Making it security definer (matching every other trigger/RPC in this
-- schema that needs to write past RLS - bootstrap_new_event(),
-- handle_new_user(), etc.) lets it keep working while direct client access
-- is fully locked down.

create or replace function public.assign_site_id()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n integer;
begin
  insert into public.event_site_counters (event_id, next_number)
  values (new.event_id, 2)
  on conflict (event_id) do update
    set next_number = public.event_site_counters.next_number + 1
  returning next_number - 1 into n;

  new.site_id := n;
  return new;
end;
$$;

alter table public.event_site_counters enable row level security;
-- No policies - not even a select policy. The only legitimate paths to this
-- table are the security-definer trigger above and the already
-- service_role-restricted import_seed_site_counter() (0023); no ordinary
-- authenticated client needs to touch it directly at all.
