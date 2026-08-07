-- Storage for the files a visitor attaches to a `photo` field.
--
-- Until now the photo field only recorded filenames client-side: the files
-- themselves were never sent anywhere, so a Project Brief listed
-- "backyard-current-deck.jpg" and the sales team had nothing to open. This
-- bucket is what makes storage: 'supabase_storage' real.
--
-- Private, like build-inspiration-photos: nothing reads these objects
-- directly. The only reader mints a short-lived signed URL server-side after
-- proving the caller belongs to the Dossier's workspace
-- (getWorkspaceDossierPhotos).
--
-- Limits mirror src/build/storage/projectPhotosBucket.ts and are asserted
-- equal by its test.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'build-project-photos',
  'build-project-photos',
  FALSE,
  8388608, -- 8 MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Deny every direct client path. Uploads go through the runtime edge handler
-- with the service-role key after session possession is proven; reads go
-- through a signed URL minted after workspace membership is proven. Neither
-- anon nor authenticated ever touches this bucket itself.
DROP POLICY IF EXISTS "No direct access to build-project-photos" ON storage.objects;
CREATE POLICY "No direct access to build-project-photos"
  ON storage.objects
  FOR ALL
  TO anon, authenticated
  USING (bucket_id = 'build-project-photos' AND FALSE)
  WITH CHECK (bucket_id = 'build-project-photos' AND FALSE);
