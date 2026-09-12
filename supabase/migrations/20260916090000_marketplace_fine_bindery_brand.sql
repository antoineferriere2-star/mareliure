-- Fine Bindery (audit du 12 septembre 2026, Phase C) — une marque commerciale
-- de plus, jamais une deuxième plateforme. `brand` distingue MA_RELIURE de
-- FINE_BINDERY, fixé une seule fois à la création d'un dossier (§65 : "il ne
-- change pas silencieusement de marque après création") et jamais ailleurs.
--
-- Additive, rejouable, même patron que les migrations précédentes.

-- ---------------------------------------------------------------------------
-- Quelle marque une Mission alimente
-- ---------------------------------------------------------------------------
ALTER TABLE public.marketplace_intake_missions
  ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT 'MA_RELIURE';
ALTER TABLE public.marketplace_intake_missions
  DROP CONSTRAINT IF EXISTS marketplace_intake_missions_brand_check;
ALTER TABLE public.marketplace_intake_missions
  ADD CONSTRAINT marketplace_intake_missions_brand_check
  CHECK (brand IN ('MA_RELIURE', 'FINE_BINDERY'));

-- ---------------------------------------------------------------------------
-- Quelle marque possède un dossier — et le snapshot de prix qui en dépend
-- ---------------------------------------------------------------------------
ALTER TABLE public.marketplace_cases
  ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT 'MA_RELIURE',
  -- §65 : "les snapshots pricing conservent brand, base_price, brand_multiplier,
  -- service_price, shipping, tax". Le transport n'a pas encore de colonne
  -- (Phase I) ; ces quatre-là existent dès que le prix est calculé, quelle
  -- que soit la marque — `brand_multiplier_bps` vaut 10 000 (×1,00) pour Ma
  -- Reliure, ce n'est pas une colonne réservée à Fine Bindery.
  ADD COLUMN IF NOT EXISTS base_service_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS brand_multiplier_bps INTEGER,
  ADD COLUMN IF NOT EXISTS service_price_cents INTEGER,
  -- Aucun moteur fiscal n'existe pour aucune marque (§14) : cet état le dit
  -- plutôt que d'inventer un montant de taxe. Une seule valeur possible pour
  -- l'instant — voir brandPricing.ts.
  ADD COLUMN IF NOT EXISTS tax_status TEXT NOT NULL DEFAULT 'TAX_REVIEW_REQUIRED';

ALTER TABLE public.marketplace_cases
  DROP CONSTRAINT IF EXISTS marketplace_cases_brand_check;
ALTER TABLE public.marketplace_cases
  ADD CONSTRAINT marketplace_cases_brand_check
  CHECK (brand IN ('MA_RELIURE', 'FINE_BINDERY'));

ALTER TABLE public.marketplace_cases
  DROP CONSTRAINT IF EXISTS marketplace_cases_tax_status_check;
ALTER TABLE public.marketplace_cases
  ADD CONSTRAINT marketplace_cases_tax_status_check
  CHECK (tax_status IN ('TAX_REVIEW_REQUIRED'));

-- Un dossier ne change jamais de marque après sa création — pas une
-- convention côté serveur, une garantie en base. Le serveur n'a d'ailleurs
-- aucun chemin qui écrirait `brand` après l'INSERT initial ; ce trigger dit
-- que même une écriture directe ne le pourrait pas.
CREATE OR REPLACE FUNCTION public.marketplace_cases_forbid_brand_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.brand IS DISTINCT FROM OLD.brand THEN
    RAISE EXCEPTION 'marketplace_cases.brand is immutable once set (case %)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_cases_brand_immutable ON public.marketplace_cases;
CREATE TRIGGER marketplace_cases_brand_immutable
  BEFORE UPDATE ON public.marketplace_cases
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_cases_forbid_brand_change();

-- ---------------------------------------------------------------------------
-- Propager la marque de la Mission au dossier qu'elle produit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marketplace_ingest_dossier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mission_brand TEXT;
BEGIN
  IF NEW.mission_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT m.brand INTO mission_brand
  FROM public.marketplace_intake_missions m
  WHERE m.mission_id = NEW.mission_id;

  -- A Mission that is not enrolled is ignored entirely: no row, no sequence
  -- consumed, no side effect. Deck and every SaaS customer's Mission take this
  -- branch and never learn that a marketplace exists.
  IF mission_brand IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.marketplace_cases (dossier_id, mission_id, reference, brand)
    VALUES (
      NEW.id,
      NEW.mission_id,
      'RL-' || lpad(nextval('public.marketplace_case_reference_seq')::text, 3, '0'),
      mission_brand
    )
    -- Idempotence, guaranteed by the UNIQUE on dossier_id. A re-ingestion
    -- attempt does nothing rather than raising.
    ON CONFLICT (dossier_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Deliberately silent, and deliberately last. The visitor's Dossier is
    -- worth more than the marketplace's bookkeeping, and the bookkeeping is
    -- repairable.
    NULL;
  END;

  RETURN NEW;
END;
$$;

-- Le rattrapage suit la même règle : un dossier recréé après coup porte la
-- marque de la Mission qui l'a produit, jamais MA_RELIURE par défaut pour
-- l'ensemble du lot.
CREATE OR REPLACE FUNCTION public.marketplace_ingest_missing_cases()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  created INTEGER;
BEGIN
  WITH missing AS (
    SELECT d.id AS dossier_id, d.mission_id, m.brand AS brand
    FROM public.build_dossiers d
    JOIN public.marketplace_intake_missions m ON m.mission_id = d.mission_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.marketplace_cases c WHERE c.dossier_id = d.id
    )
  ),
  inserted AS (
    INSERT INTO public.marketplace_cases (dossier_id, mission_id, reference, brand)
    SELECT
      dossier_id,
      mission_id,
      'RL-' || lpad(nextval('public.marketplace_case_reference_seq')::text, 3, '0'),
      brand
    FROM missing
    ON CONFLICT (dossier_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO created FROM inserted;
  RETURN created;
END;
$$;

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- DROP TRIGGER IF EXISTS marketplace_cases_brand_immutable ON public.marketplace_cases;
-- DROP FUNCTION IF EXISTS public.marketplace_cases_forbid_brand_change();
-- ALTER TABLE public.marketplace_cases
--   DROP COLUMN IF EXISTS brand,
--   DROP COLUMN IF EXISTS base_service_price_cents,
--   DROP COLUMN IF EXISTS brand_multiplier_bps,
--   DROP COLUMN IF EXISTS service_price_cents,
--   DROP COLUMN IF EXISTS tax_status;
-- ALTER TABLE public.marketplace_intake_missions DROP COLUMN IF EXISTS brand;
-- Revert marketplace_ingest_dossier() / marketplace_ingest_missing_cases() to
-- their previous bodies (git history, migration 20260908120000) if rolling back.
