-- Two more report characteristics-table fields, matching the VERT report
-- template: whether the Virtual Earthquake Reconnaissance Team is deployed
-- (in practice always "Active" for an event that has a report being
-- generated at all, but kept as free text like every other field here
-- rather than hardcoded, in case that ever needs to be corrected), and
-- whether a physical mission has been deployed/is being evaluated/etc.
alter table public.event_meta
  add column vert_deployment text,
  add column physical_mission_deployment text;

update public.event_meta
  set vert_deployment = 'Active'
  where vert_deployment is null;
