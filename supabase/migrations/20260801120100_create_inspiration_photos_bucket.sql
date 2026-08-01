-- Create the Storage bucket the inspiration-photo intake writes to.
--
-- It was created by hand in the Supabase dashboard when the feature shipped;
-- only its deny-all RLS policy ever made it into a migration
-- (20260724193011). A database rebuilt from migrations alone therefore had
-- the policy but no bucket, and every inspiration-photo upload failed.
--
-- Private on purpose: nothing reads these objects directly. Both readers
-- (getInspirationPhotoUrl for the admin Dossier view, and the visitor summary
-- route) mint a short-lived signed URL server-side with the service-role key.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'build-inspiration-photos',
  'build-inspiration-photos',
  FALSE,
  8388608, -- 8 MB, matching inspirationPhotoField.maxFileSizeMb
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;
