-- Three independent fixes/additions, bundled together since they all touch
-- the admin UI's "provision users" workflow:
--
-- 1. Backfills public.profiles for any auth.users row that predates the
--    handle_new_user() trigger (0013) - accounts created via the Supabase
--    dashboard before that migration ran never got a profiles row, so
--    list_event_members()'s left join returned a null email and the admin
--    UI fell back to showing the raw user id in the "Email" column.
-- 2. Adds profiles.display_name, synced from the same
--    auth.users.raw_user_meta_data.display_name volunteers already set for
--    themselves via LoginGateLfe's "Set your display name" step, so the
--    admin UI can show a human name instead of just an email. Also
--    settable directly by an admin (set_display_name) for a user who
--    hasn't logged in yet.
-- 3. Adds platform-wide admin provisioning (grant/revoke platform_admins)
--    so an existing platform_admin can promote someone across the whole
--    platform, not just onto one event's roster. Restricted to
--    is_platform_admin() only - deliberately NOT extended to event admins,
--    since that would let an admin of one small event escalate themselves
--    or others to platform-wide admin.

alter table public.profiles add column if not exists display_name text;

-- One-time backfill for accounts that predate the profiles mirror/trigger.
insert into public.profiles (id, email, display_name)
select id, email, nullif(raw_user_meta_data ->> 'display_name', '')
from auth.users
on conflict (id) do update
  set email = coalesce(public.profiles.email, excluded.email),
      display_name = coalesce(public.profiles.display_name, excluded.display_name);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
exception when others then
  -- Never let a profile-sync failure block a real signup.
  return new;
end;
$$;

-- Keeps profiles.email/display_name current when a user updates their own
-- metadata (LoginGateLfe's updateName()) or their email changes.
create or replace function public.handle_updated_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles
    set email = new.email,
        display_name = coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), public.profiles.display_name)
    where id = new.id;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_handle_updated_user on auth.users;
create trigger trg_handle_updated_user
  after update on auth.users
  for each row execute function public.handle_updated_user();

-- Lets an admin label a user who hasn't set their own display name yet
-- (same permission shape as lookup_user_by_email: platform_admin, or admin
-- of at least one event - matches "whoever can find a user can label them").
create or replace function public.set_display_name(p_user_id uuid, p_display_name text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not (
    public.is_platform_admin()
    or exists (select 1 from public.event_members where user_id = auth.uid() and role = 'admin')
  ) then
    raise exception 'permission denied';
  end if;

  update public.profiles set display_name = nullif(trim(p_display_name), '') where id = p_user_id;
end;
$$;

-- Same roster RPC as before, now also returning display_name. The return
-- shape changed (new display_name column), and Postgres won't let
-- CREATE OR REPLACE change a function's OUT-parameter row type, so the old
-- version must be dropped first.
drop function if exists public.list_event_members(uuid);
create or replace function public.list_event_members(p_event_id uuid)
returns table (user_id uuid, email text, display_name text, role text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_platform_admin() or public.is_event_admin(p_event_id)) then
    raise exception 'permission denied for event %', p_event_id;
  end if;

  return query
    select em.user_id, p.email, p.display_name, em.role
    from public.event_members em
    left join public.profiles p on p.id = em.user_id
    where em.event_id = p_event_id;
end;
$$;

-- Platform-wide admin roster + grant/revoke, restricted to existing
-- platform_admins only (not event admins - see comment above).
create or replace function public.list_platform_admins()
returns table (user_id uuid, email text, display_name text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'permission denied';
  end if;

  return query
    select pa.user_id, p.email, p.display_name
    from public.platform_admins pa
    left join public.profiles p on p.id = pa.user_id;
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
end;
$$;

create or replace function public.revoke_platform_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'permission denied';
  end if;
  if (select count(*) from public.platform_admins) <= 1 then
    raise exception 'cannot remove the last remaining platform admin';
  end if;
  delete from public.platform_admins where user_id = p_user_id;
end;
$$;
