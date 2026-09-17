-- Vraie architecture fiscale exploitable (brief du 17 septembre 2026) —
-- deuxième couche sur `marketplace_commercial_proposals`, purement additive.
--
-- `tax_policy` passe de la seule valeur `TAX_REVIEW_REQUIRED` à cinq
-- catégories nommées (§5) : `MANUAL_TAX_REVIEW` (renommage de
-- `TAX_REVIEW_REQUIRED` — même sens, vocabulaire aligné avec le code) reste
-- le seul défaut ; les quatre autres exigent une validation humaine tracée,
-- garantie ici au niveau base, pas seulement par convention applicative
-- (même discipline que le trigger d'immuabilité, migration 20260916100000).
--
-- Aucune ligne réelle n'a encore été acceptée à ce jour (voir CODEX_HANDOFF.md,
-- "aucun vrai paiement, aucune proposition acceptée") — le UPDATE ci-dessous
-- est une précaution, pas une migration de données de production.

UPDATE public.marketplace_commercial_proposals
  SET tax_policy = 'MANUAL_TAX_REVIEW'
  WHERE tax_policy = 'TAX_REVIEW_REQUIRED';

ALTER TABLE public.marketplace_commercial_proposals
  ALTER COLUMN tax_policy SET DEFAULT 'MANUAL_TAX_REVIEW';

ALTER TABLE public.marketplace_commercial_proposals
  ADD COLUMN IF NOT EXISTS tax_country TEXT,
  ADD COLUMN IF NOT EXISTS tax_basis TEXT,
  ADD COLUMN IF NOT EXISTS tax_validation_source TEXT,
  ADD COLUMN IF NOT EXISTS tax_validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tax_validated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.marketplace_commercial_proposals
  DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_tax_policy_check,
  DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_tax_basis_check,
  DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_tax_validation_source_check,
  DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_tax_validation_consistency_check,
  DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_tax_policy_requires_validation_check;

ALTER TABLE public.marketplace_commercial_proposals
  ADD CONSTRAINT marketplace_commercial_proposals_tax_policy_check
    CHECK (tax_policy IN (
      'MANUAL_TAX_REVIEW', 'FR_B2C', 'EU_B2C', 'NON_EU_B2C', 'NON_EU_TEMPORARY_IMPORT_REEXPORT'
    )),
  ADD CONSTRAINT marketplace_commercial_proposals_tax_basis_check
    CHECK (tax_basis IS NULL OR tax_basis IN ('service_and_shipping')),
  ADD CONSTRAINT marketplace_commercial_proposals_tax_validation_source_check
    CHECK (tax_validation_source IS NULL OR tax_validation_source IN ('manual_admin_review')),
  -- Les trois champs de validation vont ensemble : jamais l'un sans les
  -- deux autres (§9 — "un changement futur de règles ne doit jamais
  -- modifier une ancienne commande", donc pas d'état intermédiaire ambigu).
  ADD CONSTRAINT marketplace_commercial_proposals_tax_validation_consistency_check
    CHECK (
      (tax_validated_at IS NULL AND tax_validated_by IS NULL AND tax_validation_source IS NULL)
      OR (tax_validated_at IS NOT NULL AND tax_validated_by IS NOT NULL AND tax_validation_source IS NOT NULL)
    ),
  -- Le cœur de la garde-fou (§6) : une catégorie fiscale autre que
  -- `MANUAL_TAX_REVIEW` ne peut matériellement pas exister sans validation
  -- humaine tracée. Ce n'est pas une vérification applicative qu'un bug
  -- pourrait contourner.
  ADD CONSTRAINT marketplace_commercial_proposals_tax_policy_requires_validation_check
    CHECK (tax_policy = 'MANUAL_TAX_REVIEW' OR tax_validated_at IS NOT NULL);

-- L'acceptation d'une proposition (transition NULL -> accepted_at) exige
-- désormais que sa fiscalité ait déjà été validée — après quoi la ligne
-- devient immuable et ne pourrait plus jamais l'être (§10 : Checkout exige
-- une fiscalité validée, donc une proposition qu'on accepte sans l'avoir
-- validée resterait acceptée mais à jamais impayable).
CREATE OR REPLACE FUNCTION public.marketplace_commercial_proposals_forbid_change_after_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'marketplace_commercial_proposals is immutable once accepted (proposal %)', OLD.id;
  END IF;
  IF NEW.accepted_at IS NOT NULL AND NEW.tax_validated_at IS NULL THEN
    RAISE EXCEPTION 'marketplace_commercial_proposals cannot be accepted before tax validation (proposal %)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Retour arrière
--
-- À n'exécuter que si aucune proposition n'a encore été acceptée avec une
-- des quatre nouvelles catégories fiscales.
--
-- CREATE OR REPLACE FUNCTION public.marketplace_commercial_proposals_forbid_change_after_acceptance()
-- RETURNS TRIGGER LANGUAGE plpgsql AS $$
-- BEGIN
--   IF OLD.accepted_at IS NOT NULL THEN
--     RAISE EXCEPTION 'marketplace_commercial_proposals is immutable once accepted (proposal %)', OLD.id;
--   END IF;
--   RETURN NEW;
-- END;
-- $$;
-- ALTER TABLE public.marketplace_commercial_proposals
--   DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_tax_policy_requires_validation_check,
--   DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_tax_validation_consistency_check,
--   DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_tax_validation_source_check,
--   DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_tax_basis_check,
--   DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_tax_policy_check,
--   DROP COLUMN IF EXISTS tax_validated_by,
--   DROP COLUMN IF EXISTS tax_validated_at,
--   DROP COLUMN IF EXISTS tax_validation_source,
--   DROP COLUMN IF EXISTS tax_basis,
--   DROP COLUMN IF EXISTS tax_country,
--   ALTER COLUMN tax_policy SET DEFAULT 'TAX_REVIEW_REQUIRED';
-- UPDATE public.marketplace_commercial_proposals SET tax_policy = 'TAX_REVIEW_REQUIRED' WHERE tax_policy = 'MANUAL_TAX_REVIEW';
-- ADD CONSTRAINT marketplace_commercial_proposals_tax_policy_check CHECK (tax_policy IN ('TAX_REVIEW_REQUIRED'));
-- ---------------------------------------------------------------------------
