create policy "No direct access to build-inspiration-photos"
  on storage.objects
  for all
  to anon, authenticated
  using (bucket_id = 'build-inspiration-photos' and false)
  with check (bucket_id = 'build-inspiration-photos' and false);