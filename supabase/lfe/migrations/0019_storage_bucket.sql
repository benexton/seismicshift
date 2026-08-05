-- Storage bucket for observation photos/files and public snapshots. Public
-- read (same "accept it for now" tradeoff as Kumamoto's own bucket - see
-- docs/CLAUDE_CODE_scope.md discussion on media privacy), authenticated
-- write. This was missed in earlier migrations - table DDL doesn't create
-- storage buckets, so it needs its own statement.

insert into storage.buckets (id, name, public)
values ('lfe-observation-media', 'lfe-observation-media', true)
on conflict (id) do nothing;

create policy "lfe media public read" on storage.objects
  for select to public
  using (bucket_id = 'lfe-observation-media');

create policy "lfe media authenticated write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'lfe-observation-media');

create policy "lfe media authenticated update" on storage.objects
  for update to authenticated
  using (bucket_id = 'lfe-observation-media');
