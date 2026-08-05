-- One row per event (not a global singleton like Kumamoto's old event_meta).
-- Report/characteristics fields live here, separate from the events table.

create table public.event_meta (
  event_id uuid primary key references public.events (id) on delete cascade,
  -- version and location_name are free text on the report form itself (not
  -- derived from events.name/epicentre) so an admin can phrase them for the
  -- report independently, matching Kumamoto's report form fields.
  version text,
  location_name text,
  magnitude numeric,
  depth numeric,
  max_mmi text,
  faulting text,
  tsunami text,
  contributors text,
  conclusions_md text,
  report_generated_at timestamptz,
  report_generated_by text
);
