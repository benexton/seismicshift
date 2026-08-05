-- Global "can create events and provision users" role. Deliberately narrow:
-- holding this role does NOT implicitly grant access to any event's
-- triage_records/record_attachments - an admin still needs their own
-- event_members row to see a specific event's data (0016's bootstrap trigger
-- creates that automatically for events they create themselves).

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

-- A policy on platform_admins that queries platform_admins directly would hit
-- Postgres's "infinite recursion detected in policy" error, so the check goes
-- through this security-definer helper instead (same pattern as
-- is_event_writer() in 0008_rpcs.sql) - it runs with the function owner's
-- privileges, which bypasses RLS on the table it inspects.
create or replace function public.is_platform_admin()
returns boolean as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$ language sql stable security definer;

-- Readable only by other platform_admins (so the admin UI can show/manage the
-- list); no insert/update/delete policy - granting/revoking platform_admin
-- happens via the SQL editor / migrations only, matching how Kumamoto
-- accounts are provisioned by the coordinator directly today.
create policy "platform_admins select" on public.platform_admins
  for select to authenticated
  using (public.is_platform_admin());
