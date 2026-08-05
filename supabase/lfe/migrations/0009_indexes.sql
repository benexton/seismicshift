create index idx_triage_records_geom on public.triage_records using gist (geom);
create index idx_triage_records_event_status on public.triage_records (event_id, status);
create index idx_triage_records_event_site_id on public.triage_records (event_id, site_id);
create index idx_record_attachments_record_id on public.record_attachments (record_id);
create index idx_event_members_user_id on public.event_members (user_id);
