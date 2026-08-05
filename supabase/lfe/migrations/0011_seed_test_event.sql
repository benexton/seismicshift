-- One throwaway event for the Phase 1 acceptance test. Safe to delete once
-- real events exist - nothing references it by name.

insert into public.events (
  slug, name, country, country_code, event_datetime,
  epicentre_lat, epicentre_lng, languages, basemap, map_center, status, is_public
) values (
  'test-event-2026',
  'Test Event 2026',
  'New Zealand',
  'NZ',
  now(),
  -41.2865, 174.7762,
  array['en'],
  '{"osm": {"label": "OpenStreetMap", "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png", "attribution": "&copy; OpenStreetMap contributors"}}'::jsonb,
  '{"lat": -41.2865, "lng": 174.7762, "zoom": 11}'::jsonb,
  'draft',
  false
)
on conflict (slug) do nothing;

insert into public.event_meta (event_id)
select id from public.events where slug = 'test-event-2026'
on conflict (event_id) do nothing;

-- TODO: replace with a real auth.users.id once you have created a test account
-- in the new project's Auth dashboard, then run these inserts by hand:
--
-- insert into public.event_members (event_id, user_id, role)
-- select id, '00000000-0000-0000-0000-000000000000', 'admin'
-- from public.events where slug = 'test-event-2026'
-- on conflict (event_id, user_id) do nothing;
--
-- insert into public.platform_admins (user_id)
-- values ('00000000-0000-0000-0000-000000000000')
-- on conflict (user_id) do nothing;
