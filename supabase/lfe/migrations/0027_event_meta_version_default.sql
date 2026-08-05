-- Report generator's rendered title already fell back to "Version 1.0" when
-- meta.version was blank, but the editable "Event details" field itself
-- stayed empty - inconsistent, and it meant every event needed a manual
-- edit just to reach the state it should start in. Default it at the
-- source instead, and backfill existing rows created before this default
-- existed (kumamoto-2026, CatiaLaMar-2026, etc).

alter table public.event_meta alter column version set default '1.0';
update public.event_meta set version = '1.0' where version is null;
