-- Align the existing build-inspiration-photos bucket with the limits the
-- previous migration declares.
--
-- 20260801120100 creates the bucket with a size limit and a MIME allow-list,
-- but uses ON CONFLICT DO NOTHING — correct for creation, yet a no-op against
-- production, where the bucket already existed (dashboard-created, with both
-- fields NULL). The result was the very drift this whole exercise is meant to
-- remove: a database rebuilt from migrations enforced limits that production
-- did not.
--
-- An UPDATE is the converging step: idempotent, and it makes both paths end in
-- the same state. Existing objects are unaffected — these fields only gate new
-- uploads.
--
-- Values must stay in sync with src/build/storage/inspirationPhotosBucket.ts
-- (asserted by inspirationPhotosBucket.test.ts).
UPDATE storage.buckets
SET
  file_size_limit = 8388608, -- 8 MB
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'build-inspiration-photos';
