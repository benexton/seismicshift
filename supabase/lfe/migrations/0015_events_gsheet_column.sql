-- Populated by the Sheets export script on its first run per event (creates
-- a spreadsheet, then stores its id here so subsequent runs reuse it).
alter table public.events add column gsheet_id text;
