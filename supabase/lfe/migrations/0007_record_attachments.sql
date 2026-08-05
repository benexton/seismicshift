create table public.record_attachments (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.triage_records (id) on delete cascade,
  media_url text,
  source_url text,
  file_url text,
  file_name text,
  note text,
  added_by text,
  created_at timestamptz not null default now()
);
