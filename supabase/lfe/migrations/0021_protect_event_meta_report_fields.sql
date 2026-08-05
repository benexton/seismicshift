-- Closes a stored-XSS/privilege-escalation gap: the "event_meta update" RLS
-- policy (0018) is a row-level policy, so it can't itself say "any triager
-- may edit magnitude/depth/etc, but conclusions_md/report_generated_* are
-- pipeline-write-only" - RLS has no column-level granularity. A trigger does.
--
-- conclusions_md is rendered client-side via dangerouslySetInnerHTML
-- (ReportGeneratorLfe.jsx) with no sanitizer in earlier migrations, so a
-- triager could otherwise write HTML/script into it directly via the
-- Supabase client, which would then execute in another member's (including
-- an admin's) browser the next time they open the Report generator tab.
-- The app's own save form never writes these three columns itself - only
-- the service-role pipeline (scripts/lfe/generate_report.py) is meant to -
-- so this trigger simply enforces that: for any caller that is not the
-- service_role, the three fields are reverted to their previous value
-- before the row is written.

create or replace function public.protect_event_meta_report_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() is distinct from 'service_role' then
    new.conclusions_md := old.conclusions_md;
    new.report_generated_at := old.report_generated_at;
    new.report_generated_by := old.report_generated_by;
  end if;
  return new;
end;
$$;

create trigger trg_protect_event_meta_report_fields
  before update on public.event_meta
  for each row execute function public.protect_event_meta_report_fields();
