-- Attachments (images/files) now require a source URL, or an explicit
-- "not applicable" flag, when added - and the same choice is asked
-- retroactively for older attachments the first time someone tries to
-- promote one with neither to be the record's primary photo (see
-- AttachmentAdderLfe.jsx). Existing rows default to not-N/A, same as any
-- other attachment added before this migration with no source_url.

alter table public.record_attachments
  add column source_na boolean not null default false;
