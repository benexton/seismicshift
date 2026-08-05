-- Per-event sequential site numbering ("Site #1", "Site #2", ... restarting
-- for each event). A bare max(site_id)+1 query is not safe under concurrent
-- inserts, so a small counter table plus an atomic upsert is used instead:
-- the "on conflict ... do update ... returning" is a single atomic statement,
-- so two simultaneous inserts for the same event cannot receive the same number.

create table public.event_site_counters (
  event_id uuid primary key references public.events (id) on delete cascade,
  next_number integer not null default 1
);

create or replace function public.assign_site_id()
returns trigger as $$
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
$$ language plpgsql;

create trigger trg_assign_site_id
  before insert on public.triage_records
  for each row
  when (new.site_id is null)
  execute function public.assign_site_id();
