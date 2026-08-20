-- =============================================================================
-- Build to Thrive - leaderboard schema
-- Run in the Supabase SQL editor (or `supabase db push`) against the same
-- project as supabase/schema.sql (the former Kumamoto project, repurposed -
-- see the STATUS note at the top of that file). NOT the LFE project.
-- =============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

create table if not exists public.build_to_thrive_scores (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null check (char_length(trim(name)) between 1 and 60),
  email         text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  score         integer not null check (score between 0 and 200),
  building_type text,
  system_key    text,
  level_key     text
);

create index if not exists idx_build_to_thrive_scores_leaderboard
  on public.build_to_thrive_scores (score desc, created_at asc);

alter table public.build_to_thrive_scores enable row level security;
-- Deliberately no policies granted here - anon never reads or writes this
-- table directly. All access goes through the two SECURITY DEFINER
-- functions below, so email (collected for the prize draw) can never be
-- selected by a client, only name/score/building_type via the leaderboard
-- function.

-- Submit a score. The CHECK constraints on the table are the real guard
-- against garbage input; this just does the insert.
create or replace function public.submit_build_to_thrive_score(
  p_name text,
  p_email text,
  p_score integer,
  p_building_type text default null,
  p_system_key text default null,
  p_level_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
begin
  insert into public.build_to_thrive_scores (name, email, score, building_type, system_key, level_key)
  values (trim(p_name), lower(trim(p_email)), p_score, p_building_type, p_system_key, p_level_key)
  returning id into new_id;
  return new_id;
end;
$$;

-- Public leaderboard read: name + score + building_type only, never email.
create or replace function public.get_build_to_thrive_leaderboard(p_limit integer default 20)
returns table(name text, score integer, building_type text, created_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select name, score, building_type, created_at
  from public.build_to_thrive_scores
  order by score desc, created_at asc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;
