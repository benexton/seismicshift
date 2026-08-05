-- Per-country seismic-code / retrofit knowledge base (design doc 2.7).
-- Deliberately platform-wide, not event-scoped: a country's code history is
-- the same fact regardless of which event references it, and the whole
-- point is that it compounds in value as more events accrue (write
-- Venezuela's history once during the Venezuela event, reuse it unchanged
-- the next time an event happens there). Two tables: one row per country for
-- free-text overview/history, plus a repeatable timeline of discrete
-- code/standard entries (year, name, description) - modelled directly on the
-- VERT Venezuela report's "Seismic codes" section (prose) and Table 1
-- (the code-by-code timeline).

create table public.country_codes (
  country text primary key,
  overview_md text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

create table public.country_code_entries (
  id uuid primary key default gen_random_uuid(),
  country text not null references public.country_codes (country) on delete cascade,
  year_start integer not null,
  year_end integer,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_by text
);

create trigger trg_touch_country_codes_updated_at
  before update on public.country_codes
  for each row execute function public.touch_updated_at();

create index idx_country_code_entries_country on public.country_code_entries (country, year_start);

-- Any authenticated user (any role, any event, or none at all) can read -
-- "anyone with a login" per the brief. Only a triager/admin on at least one
-- event (any event - not scoped to a country's own events) may write, which
-- already covers platform admins too since they're auto-admins of every
-- event (0025).
create or replace function public.is_any_event_writer()
returns boolean as $$
  select exists (
    select 1 from public.event_members
    where user_id = auth.uid() and role in ('admin', 'triager')
  );
$$ language sql stable security definer;

alter table public.country_codes enable row level security;
alter table public.country_code_entries enable row level security;

create policy "country_codes select" on public.country_codes
  for select to authenticated
  using (true);

create policy "country_codes insert" on public.country_codes
  for insert to authenticated
  with check (public.is_any_event_writer());

create policy "country_codes update" on public.country_codes
  for update to authenticated
  using (public.is_any_event_writer());

create policy "country_codes delete" on public.country_codes
  for delete to authenticated
  using (public.is_any_event_writer());

create policy "country_code_entries select" on public.country_code_entries
  for select to authenticated
  using (true);

create policy "country_code_entries insert" on public.country_code_entries
  for insert to authenticated
  with check (public.is_any_event_writer());

create policy "country_code_entries update" on public.country_code_entries
  for update to authenticated
  using (public.is_any_event_writer());

create policy "country_code_entries delete" on public.country_code_entries
  for delete to authenticated
  using (public.is_any_event_writer());
