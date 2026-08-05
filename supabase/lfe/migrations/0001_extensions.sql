-- LFE platform - new Supabase project. Run in order against that project only.
-- This never touches the separate Kumamoto project or its schema.

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- Generic updated_at bump, reused by any table that has that column.
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
