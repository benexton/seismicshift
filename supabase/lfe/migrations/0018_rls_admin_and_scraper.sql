-- Admin-surface RLS: who can create/edit events, manage event_members, and
-- edit scraper_sources. All checks go through the security-definer helpers
-- in 0008/0014 rather than inline subqueries, to avoid the "infinite
-- recursion detected in policy" trap on event_members and platform_admins.

alter table public.scraper_sources enable row level security;

-- ---- events select, redefined -----------------------------------------
-- 0010's version only covered "public or a member" - a platform_admin who
-- hasn't joined any event yet (e.g. before creating their first one) would
-- otherwise see nothing in the admin UI's event list. is_platform_admin()
-- didn't exist when 0010 ran, so the fuller policy is defined here instead.
drop policy "events select" on public.events;

create policy "events select" on public.events
  for select to authenticated
  using (
    is_public
    or public.is_platform_admin()
    or exists (
      select 1 from public.event_members
      where event_members.event_id = events.id and event_members.user_id = auth.uid()
    )
  );

-- ---- events (insert/update) ------------------------------------------------
create policy "events insert" on public.events
  for insert to authenticated
  with check (
    public.is_platform_admin()
    and (created_by is null or created_by = auth.uid())
  );

create policy "events update" on public.events
  for update to authenticated
  using (public.is_platform_admin() or public.is_event_admin(events.id));

-- ---- event_meta update (select already exists from 0010) ------------------
-- Report/characteristics fields are edited by that event's admins/triagers,
-- same write roles as triage_records itself.
create policy "event_meta update" on public.event_meta
  for update to authenticated
  using (public.is_event_writer(event_meta.event_id));

-- ---- event_members (insert/update/delete; select already exists) ----------
create policy "event_members insert" on public.event_members
  for insert to authenticated
  with check (
    public.is_platform_admin() or public.is_event_admin(event_members.event_id)
  );

create policy "event_members update" on public.event_members
  for update to authenticated
  using (
    public.is_platform_admin() or public.is_event_admin(event_members.event_id)
  );

create policy "event_members delete" on public.event_members
  for delete to authenticated
  using (
    public.is_platform_admin() or public.is_event_admin(event_members.event_id)
  );

-- ---- scraper_sources --------------------------------------------------
create policy "scraper_sources select" on public.scraper_sources
  for select to authenticated
  using (public.is_event_member(scraper_sources.event_id));

create policy "scraper_sources insert" on public.scraper_sources
  for insert to authenticated
  with check (public.is_event_writer(scraper_sources.event_id));

create policy "scraper_sources update" on public.scraper_sources
  for update to authenticated
  using (public.is_event_writer(scraper_sources.event_id));

create policy "scraper_sources delete" on public.scraper_sources
  for delete to authenticated
  using (public.is_event_writer(scraper_sources.event_id));
