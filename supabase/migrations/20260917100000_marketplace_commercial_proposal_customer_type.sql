-- Le modèle fiscal ne doit jamais présumer que tout client est un
-- particulier (brief du 17 septembre 2026, §10) : Fine Bindery recevra à
-- terme des antiquaires, libraires, hôtels, décorateurs, sociétés, family
-- offices. Additive uniquement, sur `marketplace_commercial_proposals` —
-- même discipline que la migration `20260917090000` (aucune ligne réelle
-- acceptée n'existe encore).
--
-- Volontairement minimal : on prépare le champ, on ne construit pas
-- l'UI B2B complète ni une vérification automatique de numéro de TVA
-- (`business_vat_validation_status` reste `NOT_CHECKED` tant que rien ne
-- l'appelle).

ALTER TABLE public.marketplace_commercial_proposals
  ADD COLUMN IF NOT EXISTS customer_type TEXT NOT NULL DEFAULT 'CUSTOMER',
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS business_vat_number TEXT,
  ADD COLUMN IF NOT EXISTS business_vat_validation_status TEXT,
  ADD COLUMN IF NOT EXISTS billing_country TEXT;

ALTER TABLE public.marketplace_commercial_proposals
  DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_customer_type_check,
  DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_business_vat_status_check,
  DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_business_requires_name_check;

ALTER TABLE public.marketplace_commercial_proposals
  ADD CONSTRAINT marketplace_commercial_proposals_customer_type_check
    CHECK (customer_type IN ('CUSTOMER', 'BUSINESS')),
  ADD CONSTRAINT marketplace_commercial_proposals_business_vat_status_check
    CHECK (business_vat_validation_status IS NULL OR business_vat_validation_status IN (
      'NOT_CHECKED', 'VALID', 'INVALID', 'UNAVAILABLE'
    )),
  -- Le minimum du §10 : un client BUSINESS a au moins une raison sociale.
  -- Le numéro de TVA et le pays de facturation restent optionnels — tous
  -- les clients professionnels n'en ont pas (hors UE, par exemple).
  ADD CONSTRAINT marketplace_commercial_proposals_business_requires_name_check
    CHECK (customer_type <> 'BUSINESS' OR business_name IS NOT NULL);

-- ---------------------------------------------------------------------------
-- Retour arrière
--
-- À n'exécuter que si aucune proposition n'a encore été acceptée avec
-- customer_type = 'BUSINESS'.
--
-- ALTER TABLE public.marketplace_commercial_proposals
--   DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_business_requires_name_check,
--   DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_business_vat_status_check,
--   DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_customer_type_check,
--   DROP COLUMN IF EXISTS billing_country,
--   DROP COLUMN IF EXISTS business_vat_validation_status,
--   DROP COLUMN IF EXISTS business_vat_number,
--   DROP COLUMN IF EXISTS business_name,
--   DROP COLUMN IF EXISTS customer_type;
-- ---------------------------------------------------------------------------
