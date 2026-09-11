-- Ma Reliure — d'où vient un client (§53-§56 du cahier des charges du 11
-- septembre 2026).
--
-- Un client apporté par un atelier lui reste affecté et ne passe jamais dans
-- le matching général (voir sendCaseToBinders, qui refuse tout binderId
-- autre que referred_binder_id pour un cas BINDER_REFERRED). Cette migration
-- ne pose que la donnée ; l'exclusion du matching général est appliquée dans
-- le code serveur, pas ici.

ALTER TABLE public.marketplace_cases
  ADD COLUMN IF NOT EXISTS acquisition_origin TEXT NOT NULL DEFAULT 'MA_RELIURE_ACQUIRED',
  ADD COLUMN IF NOT EXISTS referred_binder_id UUID REFERENCES public.marketplace_binders(id) ON DELETE SET NULL;

ALTER TABLE public.marketplace_cases
  DROP CONSTRAINT IF EXISTS marketplace_cases_acquisition_origin_check,
  DROP CONSTRAINT IF EXISTS marketplace_cases_referral_origin_check;

ALTER TABLE public.marketplace_cases
  ADD CONSTRAINT marketplace_cases_acquisition_origin_check CHECK (
    acquisition_origin IN ('MA_RELIURE_ACQUIRED', 'BINDER_REFERRED')
  ),
  -- Une seule direction, délibérément — la leçon de marketplace_cases_claim_complete
  -- (audit du 8 septembre). referred_binder_id est ON DELETE SET NULL : si le
  -- compte de l'atelier référent disparaît, la colonne se vide, mais le FAIT
  -- que ce client a été apporté par un atelier (BINDER_REFERRED) est un fait
  -- historique qui doit survivre à cette suppression. La contrainte
  -- symétrique aurait empêché de supprimer ce compte.
  ADD CONSTRAINT marketplace_cases_referral_origin_check CHECK (
    referred_binder_id IS NULL OR acquisition_origin = 'BINDER_REFERRED'
  );

CREATE INDEX IF NOT EXISTS marketplace_cases_referred_binder_idx
  ON public.marketplace_cases(referred_binder_id)
  WHERE referred_binder_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- ALTER TABLE public.marketplace_cases
--   DROP CONSTRAINT IF EXISTS marketplace_cases_referral_origin_check,
--   DROP CONSTRAINT IF EXISTS marketplace_cases_acquisition_origin_check,
--   DROP COLUMN IF EXISTS referred_binder_id,
--   DROP COLUMN IF EXISTS acquisition_origin;
