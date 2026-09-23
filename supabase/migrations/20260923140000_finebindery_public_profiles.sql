-- FineBindery Network Phase 1 — projection publique volontaire d'un atelier.
-- Les tables restent service-role only. Aucun contenu privé n'est publié par défaut.

ALTER TABLE public.marketplace_binders
  ADD COLUMN IF NOT EXISTS country_code TEXT NOT NULL DEFAULT 'FR',
  ADD COLUMN IF NOT EXISTS professional_email TEXT,
  ADD COLUMN IF NOT EXISTS professional_phone TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS workshop_photo_path TEXT,
  ADD COLUMN IF NOT EXISTS public_philosophy TEXT,
  ADD COLUMN IF NOT EXISTS public_languages TEXT[] NOT NULL DEFAULT ARRAY['fr']::TEXT[],
  ADD COLUMN IF NOT EXISTS public_technique_keys TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS public_material_keys TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS public_profile_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS public_profile_published_at TIMESTAMPTZ;

ALTER TABLE public.marketplace_binders
  DROP CONSTRAINT IF EXISTS marketplace_binders_country_code_check,
  DROP CONSTRAINT IF EXISTS marketplace_binders_public_profile_status_check,
  ADD CONSTRAINT marketplace_binders_country_code_check
    CHECK (country_code ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT marketplace_binders_public_profile_status_check
    CHECK (public_profile_status IN ('draft', 'published'));

CREATE INDEX IF NOT EXISTS marketplace_binders_public_profiles_idx
  ON public.marketplace_binders(country_code, personal_referral_slug)
  WHERE status = 'approved' AND public_profile_status = 'published';

ALTER TABLE public.marketplace_binder_portfolio
  ADD COLUMN IF NOT EXISTS source_work_id UUID REFERENCES public.marketplace_binder_works(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS publication_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.marketplace_binder_portfolio
  DROP CONSTRAINT IF EXISTS marketplace_binder_portfolio_publication_check,
  ADD CONSTRAINT marketplace_binder_portfolio_publication_check CHECK (
    NOT is_published OR (
      publication_consent_at IS NOT NULL
      AND (before_photo_path IS NOT NULL OR after_photo_path IS NOT NULL)
    )
  );

DROP TRIGGER IF EXISTS marketplace_binder_portfolio_touch ON public.marketplace_binder_portfolio;
CREATE TRIGGER marketplace_binder_portfolio_touch
  BEFORE UPDATE ON public.marketplace_binder_portfolio
  FOR EACH ROW EXECUTE FUNCTION public.build_touch_updated_at();

CREATE INDEX IF NOT EXISTS marketplace_binder_portfolio_public_idx
  ON public.marketplace_binder_portfolio(binder_id, position)
  WHERE is_published = true AND publication_consent_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.marketplace_binder_portfolio_work_same_binder()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.source_work_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.marketplace_binder_works w
    WHERE w.id = NEW.source_work_id AND w.binder_id = NEW.binder_id
  ) THEN
    RAISE EXCEPTION 'portfolio source work must belong to the same binder';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.marketplace_binder_portfolio_work_same_binder()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS marketplace_binder_portfolio_work_guard
  ON public.marketplace_binder_portfolio;
CREATE TRIGGER marketplace_binder_portfolio_work_guard
  BEFORE INSERT OR UPDATE OF source_work_id, binder_id
  ON public.marketplace_binder_portfolio
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_binder_portfolio_work_same_binder();

ALTER TABLE public.marketplace_cases
  DROP CONSTRAINT IF EXISTS marketplace_cases_referral_origin_check,
  DROP CONSTRAINT IF EXISTS marketplace_cases_acquisition_origin_check;

ALTER TABLE public.marketplace_cases
  ADD CONSTRAINT marketplace_cases_acquisition_origin_check CHECK (
    acquisition_origin IN ('MA_RELIURE_ACQUIRED', 'BINDER_REFERRED', 'FINEBINDERY_PROFILE')
  ),
  ADD CONSTRAINT marketplace_cases_referral_origin_check CHECK (
    referred_binder_id IS NULL
    OR acquisition_origin IN ('BINDER_REFERRED', 'FINEBINDERY_PROFILE')
  );

-- Rollback volontairement non exécuté : remettre les contraintes précédentes,
-- supprimer les index/colonnes ajoutés et le trigger portfolio après vérification
-- qu'aucun profil ni dossier FineBindery ne les utilise.
