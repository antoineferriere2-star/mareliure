DROP POLICY IF EXISTS "No direct access to build-project-photos" ON storage.objects;
CREATE POLICY "No direct access to build-project-photos"
  ON storage.objects
  FOR ALL
  TO anon, authenticated
  USING (bucket_id = 'build-project-photos' AND FALSE)
  WITH CHECK (bucket_id = 'build-project-photos' AND FALSE);