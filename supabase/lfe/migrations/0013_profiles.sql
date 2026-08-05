-- Mirrors auth.users(id, email) so the admin UI can look up an existing user
-- by email without needing the auth admin API (which would need a
-- service-role call from somewhere - deliberately avoided this round).
-- A trigger on auth.users is a known footgun: if this function throws, or its
-- search_path is left mutable, every future signup breaks, not just this
-- feature. Both are guarded against explicitly below.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create index idx_profiles_email on public.profiles (email);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
exception when others then
  -- Never let a profile-sync failure block a real signup.
  return new;
end;
$$;

create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- No select/insert/update/delete policy is granted here on purpose. Looking
-- up a user must go through lookup_user_by_email() (0017), which returns
-- only a single id for an exact, caller-supplied email - a raw table-select
-- policy would let any one event's admin read every user's email platform-wide.
alter table public.profiles enable row level security;
