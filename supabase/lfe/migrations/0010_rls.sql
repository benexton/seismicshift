-- All row-level security for the LFE platform, in one file so the security
-- model is reviewable as a single unit before this runs against a live project.
-- The security boundary is event_members: a user with no row there for an
-- event has no access to that event's data at all.

alter table public.events enable row level security;
alter table public.event_meta enable row level security;
alter table public.event_members enable row level security;
alter table public.triage_records enable row level security;
alter table public.record_attachments enable row level security;

-- ---- events -----------------------------------------------------------
-- Readable if public, or if the caller is a member (any role).
create policy "events select" on public.events
  for select to authenticated
  using (
    is_public
    or exists (
      select 1 from public.event_members
      where event_members.event_id = events.id and event_members.user_id = auth.uid()
    )
  );

-- Event creation/editing is admin-console work (phase 2); no insert/update
-- policy for authenticated/anon here, so only migrations and service-role
-- callers (which bypass RLS) can write in phase 1.

-- ---- event_meta ---------------------------------------------------------
create policy "event_meta select" on public.event_meta
  for select to authenticated
  using (
    exists (
      select 1 from public.events
      where events.id = event_meta.event_id
        and (
          events.is_public
          or exists (
            select 1 from public.event_members
            where event_members.event_id = events.id and event_members.user_id = auth.uid()
          )
        )
    )
  );

-- ---- event_members -------------------------------------------------------
-- You can see your own membership row, and admins can see the full roster.
-- This goes through is_event_admin() (0008) rather than a subquery on
-- event_members itself - a policy on a table that queries that same table
-- directly hits Postgres's "infinite recursion detected in policy" error.
create policy "event_members select" on public.event_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_event_admin(event_members.event_id)
  );

-- Provisioning users onto an event needs the auth admin API and runs
-- server-side (service role) - no insert/update/delete policy for
-- authenticated/anon in phase 1.

-- ---- triage_records --------------------------------------------------
create policy "triage_records select" on public.triage_records
  for select to authenticated
  using (
    exists (
      select 1 from public.event_members
      where event_members.event_id = triage_records.event_id
        and event_members.user_id = auth.uid()
    )
  );

create policy "triage_records insert" on public.triage_records
  for insert to authenticated
  with check (
    exists (
      select 1 from public.event_members
      where event_members.event_id = triage_records.event_id
        and event_members.user_id = auth.uid()
        and event_members.role in ('admin', 'triager')
    )
  );

create policy "triage_records update" on public.triage_records
  for update to authenticated
  using (
    exists (
      select 1 from public.event_members
      where event_members.event_id = triage_records.event_id
        and event_members.user_id = auth.uid()
        and event_members.role in ('admin', 'triager')
    )
  );

-- No delete policy - records are never hard-deleted, only merged/rejected.

-- ---- record_attachments --------------------------------------------------
create policy "record_attachments select" on public.record_attachments
  for select to authenticated
  using (
    exists (
      select 1 from public.triage_records
      join public.event_members
        on event_members.event_id = triage_records.event_id
       and event_members.user_id = auth.uid()
      where triage_records.id = record_attachments.record_id
    )
  );

create policy "record_attachments insert" on public.record_attachments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.triage_records
      join public.event_members
        on event_members.event_id = triage_records.event_id
       and event_members.user_id = auth.uid()
       and event_members.role in ('admin', 'triager')
      where triage_records.id = record_attachments.record_id
    )
  );

create policy "record_attachments update" on public.record_attachments
  for update to authenticated
  using (
    exists (
      select 1 from public.triage_records
      join public.event_members
        on event_members.event_id = triage_records.event_id
       and event_members.user_id = auth.uid()
       and event_members.role in ('admin', 'triager')
      where triage_records.id = record_attachments.record_id
    )
  );

create policy "record_attachments delete" on public.record_attachments
  for delete to authenticated
  using (
    exists (
      select 1 from public.triage_records
      join public.event_members
        on event_members.event_id = triage_records.event_id
       and event_members.user_id = auth.uid()
       and event_members.role in ('admin', 'triager')
      where triage_records.id = record_attachments.record_id
    )
  );
