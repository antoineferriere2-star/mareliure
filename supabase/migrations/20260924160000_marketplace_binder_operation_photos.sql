-- Photos d'exemple par opération : la bibliothèque de l'atelier.
--
-- Un relieur montre ses réalisations pour une opération (demi-cuir, dorure,
-- restauration…) et les retrouve automatiquement quand il l'ajoute à un devis.
-- Une photo est rattachée à UNE opération, de l'une des deux sources que le
-- constructeur de devis propose :
--   - une prestation personnelle de l'atelier (`service_id`) ;
--   - un tarif de base Ma Reliure (`pricing_key`), qui n'a pas de `service_id`.
--
-- Le devis ne pointe jamais vers cette table : la photo y est COPIÉE dans
-- `marketplace_binder_quote_item_photos`. Supprimer un exemple ne change donc
-- aucun devis déjà envoyé.
--
-- Aucune donnée n'est modifiée. Les fichiers vivent dans le bucket privé
-- existant `marketplace-quote-operation-photos`, sous `<binder_id>/library/`.

CREATE TABLE IF NOT EXISTS public.marketplace_binder_operation_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  binder_id UUID NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.marketplace_binder_services(id) ON DELETE CASCADE,
  pricing_key TEXT REFERENCES public.marketplace_work_items(key) ON DELETE RESTRICT,
  storage_path TEXT NOT NULL UNIQUE,
  caption TEXT,
  position INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_binder_operation_photos_one_target_check
    CHECK (num_nonnulls(service_id, pricing_key) = 1),
  CONSTRAINT marketplace_binder_operation_photos_caption_check
    CHECK (caption IS NULL OR char_length(caption) <= 300),
  CONSTRAINT marketplace_binder_operation_photos_position_check
    CHECK (position BETWEEN 1 AND 20),
  CONSTRAINT marketplace_binder_operation_photos_path_check
    CHECK (storage_path LIKE binder_id::TEXT || '/library/%')
);

CREATE INDEX IF NOT EXISTS marketplace_binder_operation_photos_service_idx
  ON public.marketplace_binder_operation_photos(binder_id, service_id, position)
  WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketplace_binder_operation_photos_pricing_idx
  ON public.marketplace_binder_operation_photos(binder_id, pricing_key, position)
  WHERE pricing_key IS NOT NULL;

-- Même discipline que les photos de devis : aucun accès direct, tout passe par
-- les fonctions serveur qui résolvent l'atelier depuis la session.
GRANT ALL ON public.marketplace_binder_operation_photos TO service_role;
ALTER TABLE public.marketplace_binder_operation_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_binder_operation_photos" ON public.marketplace_binder_operation_photos;
CREATE POLICY "No direct access to marketplace_binder_operation_photos"
  ON public.marketplace_binder_operation_photos FOR ALL TO anon, authenticated
  USING (FALSE) WITH CHECK (FALSE);
