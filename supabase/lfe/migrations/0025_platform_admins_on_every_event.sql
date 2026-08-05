-- Platform admins are meant to be able to administer any event ("across the
-- board", not just ones they personally created), but until now they only
-- got an actual event_members row for events they created themselves - a
-- platform_admin promoted after the fact, or one who didn't create a given
-- event, had platform_admin-gated UI access (via is_platform_admin() checks)
-- but no admin row showing up in that event's own membership list. This
-- migration makes "platform admin" mean "admin member of every event," kept
-- in sync going forward from both directions:
--   1. Creating a new event now adds every current platform_admin as an
--      admin member of it (bootstrap_new_event, extended).
--   2. Granting platform_admin now adds that user as an admin member of
--      every existing event (grant_platform_admin, extended).
-- Plus a one-time backfill for the events/platform_admins that already
-- exist today.

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

  insert into public.event_members (event_id, user_id, role)
  select new.id, pa.user_id, 'admin' from public.platform_admins pa
  on conflict (event_id, user_id) do update set role = 'admin';

  return new;
end;
$$;

create or replace function public.grant_platform_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'permission denied';
  end if;
  insert into public.platform_admins (user_id) values (p_user_id) on conflict (user_id) do nothing;

  insert into public.event_members (event_id, user_id, role)
  select e.id, p_user_id, 'admin' from public.events e
  on conflict (event_id, user_id) do update set role = 'admin';
end;
$$;

-- One-time backfill: every current platform_admin becomes an admin member
-- of every event that already exists.
insert into public.event_members (event_id, user_id, role)
select e.id, pa.user_id, 'admin'
from public.events e
cross join public.platform_admins pa
on conflict (event_id, user_id) do update set role = 'admin';
