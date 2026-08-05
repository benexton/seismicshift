-- When a platform_admin creates an event client-side (RLS-governed insert,
-- see 0018), there is otherwise no path for them to also create the required
-- event_meta row or their own event_members admin row - two separate inserts
-- they could easily forget, and the second one is a bootstrap chicken-and-egg
-- problem (event_members' own insert policy requires already being an admin
-- of that event). This trigger closes both gaps in one atomic step.

create or replace function public.bootstrap_new_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.event_meta (event_id) values (new.id)
  on conflict (event_id) do nothing;

  if new.created_by is not null then
    insert into public.event_members (event_id, user_id, role)
    values (new.id, new.created_by, 'admin')
    on conflict (event_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger trg_bootstrap_new_event
  after insert on public.events
  for each row execute function public.bootstrap_new_event();
