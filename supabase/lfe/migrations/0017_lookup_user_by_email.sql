-- Provisioning-by-email for the admin UI, without a raw select policy on
-- profiles (which would let one small event's admin read every user's email
-- platform-wide - a real cross-tenant leak at the user-directory layer).
-- Returns only the id for an exact, caller-supplied email; the caller must
-- already be a platform_admin or an admin of at least one event, so a random
-- authenticated viewer/triager cannot use this to probe the user directory.

create or replace function public.lookup_user_by_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  found_id uuid;
begin
  if not (
    public.is_platform_admin()
    or exists (select 1 from public.event_members where user_id = auth.uid() and role = 'admin')
  ) then
    raise exception 'permission denied';
  end if;

  select id into found_id from public.profiles where email = p_email;
  return found_id;
end;
$$;

-- Roster for one event, with emails - scoped to that single event's members
-- rather than a raw profiles select, so an admin of a small event still
-- cannot see users of unrelated events.
create or replace function public.list_event_members(p_event_id uuid)
returns table (user_id uuid, email text, role text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_platform_admin() or public.is_event_admin(p_event_id)) then
    raise exception 'permission denied for event %', p_event_id;
  end if;

  return query
    select em.user_id, p.email, em.role
    from public.event_members em
    left join public.profiles p on p.id = em.user_id
    where em.event_id = p_event_id;
end;
$$;
