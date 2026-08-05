-- Closes a cross-tenant tampering gap: the "lfe media authenticated update"
-- policy from 0019 let ANY authenticated user overwrite ANY existing object
-- in the bucket, since it checked only bucket_id - no ownership or
-- event-membership scoping at all. Object paths are discoverable by anyone
-- via the public snapshot JSON for is_public events (media_url is published
-- verbatim), so this was concretely exploitable across tenants.
--
-- The fix is simply to remove the ability to update/overwrite an existing
-- object via the client, rather than trying to scope it by path/ownership:
-- every upload path in src/lib/mediaLfe.js includes a fresh timestamp plus a
-- random suffix, so the app never legitimately needs to overwrite an
-- existing object - each upload is always a brand-new, unique object. The
-- "insert" policy (new objects only) already covers every real upload path.

drop policy "lfe media authenticated update" on storage.objects;
