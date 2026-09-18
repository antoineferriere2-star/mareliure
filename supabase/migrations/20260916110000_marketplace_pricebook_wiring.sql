-- Câblage de pricebookReferenceCents dossier par dossier (audit du
-- 15 septembre 2026, §3.1 ; docs/commercial-billing-model.md). Jusqu'ici
-- marketplace_pricebook servait uniquement la détection de dérive
-- (detectDrift) : cette migration ne change rien à cet usage, elle ajoute
-- deux endroits pour conserver ce que le moteur en tire une fois qu'il la
-- relit dossier par dossier (resolveServicePriceFloors, pricebook.ts).
--
-- Additive, rejouable : chaque colonne est ajoutée sous garde.

ALTER TABLE public.marketplace_cases
  ADD COLUMN IF NOT EXISTS pricing_pricebook_reference_cents INTEGER,
  ADD COLUMN IF NOT EXISTS pricing_price_bound_by TEXT;

ALTER TABLE public.marketplace_cases
  DROP CONSTRAINT IF EXISTS marketplace_cases_pricing_price_bound_by_check;
ALTER TABLE public.marketplace_cases
  ADD CONSTRAINT marketplace_cases_pricing_price_bound_by_check
    CHECK (pricing_price_bound_by IS NULL
           OR pricing_price_bound_by IN ('reference', 'margin_floor', 'contribution_floor'));

-- La provenance Pricebook d'une proposition figée : quelles entrées
-- publiées (travail, format, complexité, version, prix) ont produit
-- pricebook_reference_cents. Un tableau plutôt qu'une table à part : ces
-- lignes ne sont jamais interrogées seules, seulement relues avec la
-- proposition qui les a gelées — la même figure que pricing_components sur
-- marketplace_cases.
ALTER TABLE public.marketplace_commercial_proposals
  ADD COLUMN IF NOT EXISTS pricebook_provenance JSONB;

-- ---------------------------------------------------------------------------
-- Retour arrière
--
-- ALTER TABLE public.marketplace_commercial_proposals
--   DROP COLUMN IF EXISTS pricebook_provenance;
-- ALTER TABLE public.marketplace_cases
--   DROP CONSTRAINT IF EXISTS marketplace_cases_pricing_price_bound_by_check,
--   DROP COLUMN IF EXISTS pricing_price_bound_by,
--   DROP COLUMN IF EXISTS pricing_pricebook_reference_cents;
-- ---------------------------------------------------------------------------
