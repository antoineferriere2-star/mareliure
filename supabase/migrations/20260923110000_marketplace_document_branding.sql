-- Identité visuelle des devis et factures. Le chemin du logo est recopié dans
-- le snapshot `issuer` ; les anciens documents gardent donc leur version.

ALTER TABLE public.marketplace_binder_billing_profiles
  ADD COLUMN IF NOT EXISTS binder_name TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS logo_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS document_accent_color TEXT NOT NULL DEFAULT '#7A2230',
  ADD COLUMN IF NOT EXISTS document_footer TEXT;

ALTER TABLE public.marketplace_binder_billing_profiles
  DROP CONSTRAINT IF EXISTS marketplace_binder_billing_profiles_accent_check;
ALTER TABLE public.marketplace_binder_billing_profiles
  ADD CONSTRAINT marketplace_binder_billing_profiles_accent_check
    CHECK (document_accent_color IN ('#7A2230', '#24483D', '#263A57', '#3B342E'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('marketplace-binder-document-logos', 'marketplace-binder-document-logos', FALSE, 2097152,
        ARRAY['image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "No direct access to marketplace-binder-document-logos" ON storage.objects;
CREATE POLICY "No direct access to marketplace-binder-document-logos"
  ON storage.objects FOR ALL TO anon, authenticated
  USING (bucket_id = 'marketplace-binder-document-logos' AND FALSE)
  WITH CHECK (bucket_id = 'marketplace-binder-document-logos' AND FALSE);
