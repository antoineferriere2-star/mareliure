-- Ma Reliure — trois modes commerciaux (§23-§31 du cahier des charges du
-- 11 septembre 2026), sur ce qui existe déjà : le Pricebook unique, la marge
-- plancher et la fourchette basse/haute étaient déjà en production (migration
-- 20260909120000). Cette migration n'ajoute que ce qui manquait :
-- l'étiquette de mode, l'acompte, et la rémunération différenciée par
-- atelier par famille de métier — jamais une seconde grille de prix client.

ALTER TABLE public.marketplace_cases
  ADD COLUMN IF NOT EXISTS pricing_mode TEXT,
  ADD COLUMN IF NOT EXISTS deposit_cents INTEGER;

ALTER TABLE public.marketplace_cases
  DROP CONSTRAINT IF EXISTS marketplace_cases_pricing_mode_check,
  DROP CONSTRAINT IF EXISTS marketplace_cases_deposit_check;

ALTER TABLE public.marketplace_cases
  ADD CONSTRAINT marketplace_cases_pricing_mode_check CHECK (
    pricing_mode IS NULL
    OR pricing_mode IN ('FIXED_PRICE', 'ESTIMATE_THEN_CONFIRM', 'MANUAL_STUDY')
  ),
  ADD CONSTRAINT marketplace_cases_deposit_check CHECK (deposit_cents IS NULL OR deposit_cents > 0);

-- ---------------------------------------------------------------------------
-- Conditions commerciales par atelier — §31
-- ---------------------------------------------------------------------------
-- Pas une grille complète par atelier (45 travaux × N ateliers) : un
-- multiplicateur par famille de métier (marketplace_work_items.family, déjà
-- la bonne clé). Le relieur ne les administre pas — RLS deny-all, comme
-- partout ailleurs dans ce schéma.
CREATE TABLE IF NOT EXISTS public.marketplace_binder_commercial_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  binder_id UUID NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE CASCADE,
  family_key TEXT NOT NULL,
  -- 10 000 pb = inchangé. 10 500 = +5 %. 9 000 = -10 %.
  payout_multiplier_bps INTEGER NOT NULL DEFAULT 10000,
  -- Certaines catégories ne se multiplient jamais à l'aveugle (restauration
  -- patrimoniale, exemple du cahier des charges) : un humain fixe le montant,
  -- le multiplicateur n'est alors qu'indicatif.
  manual_payout_required BOOLEAN NOT NULL DEFAULT false,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_binder_commercial_terms_family_check CHECK (family_key IN (
    'repair', 'cloth', 'leather', 'gilding', 'finishing', 'protection', 'restoration', 'creation'
  )),
  CONSTRAINT marketplace_binder_commercial_terms_multiplier_check
    CHECK (payout_multiplier_bps > 0),
  CONSTRAINT marketplace_binder_commercial_terms_effective_check
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
GRANT ALL ON public.marketplace_binder_commercial_terms TO service_role;
ALTER TABLE public.marketplace_binder_commercial_terms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_binder_commercial_terms"
  ON public.marketplace_binder_commercial_terms;
CREATE POLICY "No direct access to marketplace_binder_commercial_terms"
  ON public.marketplace_binder_commercial_terms FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- Une seule condition active par atelier et par famille : effective_to NULL
-- marque celle qui s'applique aujourd'hui. Une nouvelle condition ferme
-- l'ancienne (effective_to renseigné) plutôt que de la remplacer — l'historique
-- des conditions reste lisible.
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_binder_commercial_terms_active_uidx
  ON public.marketplace_binder_commercial_terms(binder_id, family_key)
  WHERE effective_to IS NULL;

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- DROP TABLE IF EXISTS public.marketplace_binder_commercial_terms;
-- ALTER TABLE public.marketplace_cases
--   DROP CONSTRAINT IF EXISTS marketplace_cases_deposit_check,
--   DROP CONSTRAINT IF EXISTS marketplace_cases_pricing_mode_check,
--   DROP COLUMN IF EXISTS deposit_cents,
--   DROP COLUMN IF EXISTS pricing_mode;
