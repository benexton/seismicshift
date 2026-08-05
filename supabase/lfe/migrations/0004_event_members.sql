-- Who can see and touch an event's data. This is the access-control boundary
-- enforced by RLS in 0010_rls.sql - a user with no row here for an event has
-- no access to that event's records at all.

create table public.event_members (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'triager', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
