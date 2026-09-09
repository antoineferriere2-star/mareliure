-- Ma Reliure — le référentiel tarifaire de terrain.
--
-- Trois objets, trois natures différentes, et c'est tout l'intérêt de les
-- séparer :
--
--   marketplace_work_items       ce que le métier sait faire
--   marketplace_binder_rates     ce que chaque relieur demande  (observation)
--   marketplace_pricebook        ce que Ma Reliure paie et vend (décision)
--
-- Les confondre était la faute d'origine : des montants inventés vivaient dans
-- le code au même rang qu'un tarif relevé chez un artisan. Ici, une ligne porte
-- toujours sa provenance, et `provenance = 'REAL_VERIFIED'` est la seule qui
-- compte comme référence de marché.
--
-- Rejouable : chaque objet est créé conditionnellement, chaque contrainte est
-- supprimée avant d'être reposée. Rollback en fin de fichier, en commentaire.

-- ---------------------------------------------------------------------------
-- 1. Catalogue des travaux
-- ---------------------------------------------------------------------------
-- Projection administrable du catalogue déclaré dans src/marketplace/pricing/
-- catalog.ts. Le code reste la source de vérité pour ce qu'il sait résoudre ;
-- cette table porte les libellés et les ajouts faits depuis l'administration.

CREATE TABLE IF NOT EXISTS public.marketplace_work_items (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  family TEXT NOT NULL,
  role TEXT NOT NULL,
  requires_study BOOLEAN NOT NULL DEFAULT false,
  hint TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_work_items
  DROP CONSTRAINT IF EXISTS marketplace_work_items_family_check,
  DROP CONSTRAINT IF EXISTS marketplace_work_items_role_check;

ALTER TABLE public.marketplace_work_items
  ADD CONSTRAINT marketplace_work_items_family_check CHECK (family IN (
    'repair', 'cloth', 'leather', 'gilding', 'finishing',
    'protection', 'restoration', 'creation'
  )),
  ADD CONSTRAINT marketplace_work_items_role_check
    CHECK (role IN ('structure', 'complement'));

ALTER TABLE public.marketplace_work_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_work_items"
  ON public.marketplace_work_items;
CREATE POLICY "No direct access to marketplace_work_items"
  ON public.marketplace_work_items FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 2. Grilles des relieurs
-- ---------------------------------------------------------------------------
-- Une ligne = une phrase dite par un artisan un jour donné, sur un travail,
-- dans un format et une complexité. On la garde telle quelle et on ne la
-- moyenne qu'avec des phrases comparables.

CREATE TABLE IF NOT EXISTS public.marketplace_binder_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  binder_id UUID NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE CASCADE,
  work_item_key TEXT NOT NULL REFERENCES public.marketplace_work_items(key),
  minimum_payout_cents INTEGER NOT NULL,
  typical_payout_cents INTEGER NOT NULL,
  maximum_payout_cents INTEGER NOT NULL,
  estimated_hours NUMERIC(6, 2),
  size_class TEXT NOT NULL DEFAULT 'standard',
  complexity_class TEXT NOT NULL DEFAULT 'standard',
  notes TEXT,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT NOT NULL,
  provenance TEXT NOT NULL,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.marketplace_binder_rates
  DROP CONSTRAINT IF EXISTS marketplace_binder_rates_amounts_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_rates_size_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_rates_complexity_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_rates_status_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_rates_source_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_rates_provenance_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_rates_verified_check;

ALTER TABLE public.marketplace_binder_rates
  -- Cohérence interne d'une grille. On ne discute pas le tarif d'un artisan,
  -- on vérifie seulement qu'il est cohérent avec lui-même.
  ADD CONSTRAINT marketplace_binder_rates_amounts_check CHECK (
    minimum_payout_cents > 0
    AND minimum_payout_cents <= typical_payout_cents
    AND typical_payout_cents <= maximum_payout_cents
  ),
  ADD CONSTRAINT marketplace_binder_rates_size_check
    CHECK (size_class IN ('small', 'standard', 'large', 'oversize')),
  ADD CONSTRAINT marketplace_binder_rates_complexity_check
    CHECK (complexity_class IN ('simple', 'standard', 'complex')),
  ADD CONSTRAINT marketplace_binder_rates_status_check
    CHECK (status IN ('draft', 'active', 'superseded')),
  ADD CONSTRAINT marketplace_binder_rates_source_check CHECK (source IN (
    'binder_interview', 'binder_import', 'historical_order', 'admin_entry'
  )),
  ADD CONSTRAINT marketplace_binder_rates_provenance_check CHECK (provenance IN (
    'REAL_VERIFIED', 'ADMIN_VALIDATED', 'DEMO', 'PLACEHOLDER', 'TEST_ONLY'
  )),
  -- La contrainte qui porte le sens : une ligne ne peut pas se prétendre
  -- vérifiée sans dire par qui et quand. Sans cela, `REAL_VERIFIED` serait une
  -- case à cocher, et la traçabilité une intention.
  ADD CONSTRAINT marketplace_binder_rates_verified_check CHECK (
    provenance <> 'REAL_VERIFIED'
    OR (verified_at IS NOT NULL AND verified_by IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS marketplace_binder_rates_binder_idx
  ON public.marketplace_binder_rates(binder_id);
CREATE INDEX IF NOT EXISTS marketplace_binder_rates_lookup_idx
  ON public.marketplace_binder_rates(work_item_key, size_class, complexity_class)
  WHERE status = 'active';

ALTER TABLE public.marketplace_binder_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_binder_rates"
  ON public.marketplace_binder_rates;
CREATE POLICY "No direct access to marketplace_binder_rates"
  ON public.marketplace_binder_rates FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 3. Pricebook Ma Reliure
-- ---------------------------------------------------------------------------
-- Notre décision commerciale. Ne se recalibre jamais tout seul : qu'un relieur
-- change ses tarifs doit alerter quelqu'un, pas déplacer un prix de vente.

CREATE TABLE IF NOT EXISTS public.marketplace_pricebook (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_key TEXT NOT NULL REFERENCES public.marketplace_work_items(key),
  size_class TEXT NOT NULL DEFAULT 'standard',
  complexity_class TEXT NOT NULL DEFAULT 'standard',
  reference_binder_payout_cents INTEGER NOT NULL,
  customer_price_cents INTEGER NOT NULL,
  target_margin_cents INTEGER NOT NULL,
  target_margin_bps INTEGER NOT NULL,
  pricing_method TEXT NOT NULL DEFAULT 'margin_target',
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  reference_count_at_validation INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_pricebook
  DROP CONSTRAINT IF EXISTS marketplace_pricebook_amounts_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricebook_method_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricebook_status_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricebook_published_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricebook_size_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricebook_complexity_check;

ALTER TABLE public.marketplace_pricebook
  ADD CONSTRAINT marketplace_pricebook_amounts_check CHECK (
    reference_binder_payout_cents > 0
    AND customer_price_cents > 0
    AND reference_binder_payout_cents <= customer_price_cents
  ),
  ADD CONSTRAINT marketplace_pricebook_method_check
    CHECK (pricing_method IN ('margin_target', 'fixed_price', 'manual')),
  ADD CONSTRAINT marketplace_pricebook_status_check
    CHECK (status IN ('draft', 'published', 'retired')),
  ADD CONSTRAINT marketplace_pricebook_size_check
    CHECK (size_class IN ('small', 'standard', 'large', 'oversize')),
  ADD CONSTRAINT marketplace_pricebook_complexity_check
    CHECK (complexity_class IN ('simple', 'standard', 'complex')),
  -- Un prix publié dit qui l'a arrêté et quand. C'est ce qui permettra de
  -- répondre « quel prix était en vigueur le jour de cette commande ».
  ADD CONSTRAINT marketplace_pricebook_published_check CHECK (
    status <> 'published'
    OR (validated_at IS NOT NULL AND validated_by IS NOT NULL)
  );

-- Une seule entrée publiée par travail et par classe. Les versions retirées
-- restent, c'est l'historique des prix.
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_pricebook_published_unique
  ON public.marketplace_pricebook(work_item_key, size_class, complexity_class)
  WHERE status = 'published';

ALTER TABLE public.marketplace_pricebook ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_pricebook"
  ON public.marketplace_pricebook;
CREATE POLICY "No direct access to marketplace_pricebook"
  ON public.marketplace_pricebook FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 4. Le refus d'un atelier comme signal de prix
-- ---------------------------------------------------------------------------
-- Quand un relieur refuse pour rémunération insuffisante, il peut dire à quel
-- montant il aurait accepté. C'est la donnée la plus honnête du système : elle
-- est révélée par une décision réelle, pas déclarée dans un entretien.
--
-- Elle ne modifie jamais le Pricebook. Elle alimente l'analyse.

ALTER TABLE public.marketplace_case_matches
  ADD COLUMN IF NOT EXISTS minimum_required_payout_cents INTEGER;

ALTER TABLE public.marketplace_case_matches
  DROP CONSTRAINT IF EXISTS marketplace_case_matches_minimum_payout_check;
ALTER TABLE public.marketplace_case_matches
  ADD CONSTRAINT marketplace_case_matches_minimum_payout_check CHECK (
    minimum_required_payout_cents IS NULL OR minimum_required_payout_cents > 0
  );

-- ---------------------------------------------------------------------------
-- 5. Le dossier retient sa décomposition
-- ---------------------------------------------------------------------------
-- `pricing_status` gagne 'manual_review' : le moteur peut désormais refuser de
-- chiffrer, et ce refus est un état, pas une absence.

ALTER TABLE public.marketplace_cases
  ADD COLUMN IF NOT EXISTS pricing_components JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pricing_low_estimate_cents INTEGER,
  ADD COLUMN IF NOT EXISTS pricing_high_estimate_cents INTEGER,
  ADD COLUMN IF NOT EXISTS pricing_reference_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.marketplace_cases
  DROP CONSTRAINT IF EXISTS marketplace_cases_pricing_status_check,
  DROP CONSTRAINT IF EXISTS marketplace_cases_pricing_confidence_check;

ALTER TABLE public.marketplace_cases
  ADD CONSTRAINT marketplace_cases_pricing_status_check
    CHECK (pricing_status IN ('pending', 'suggested', 'validated', 'manual_review')),
  ADD CONSTRAINT marketplace_cases_pricing_confidence_check
    CHECK (pricing_confidence IS NULL
           OR pricing_confidence IN ('manual_review', 'low', 'medium', 'high'));


-- ---------------------------------------------------------------------------
-- 6. Semence du catalogue
-- ---------------------------------------------------------------------------
-- Projetée depuis src/marketplace/pricing/catalog.ts, qui reste la source de
-- vérité pour ce que le moteur sait résoudre. Rejouable : un libellé corrigé
-- dans le code se propage, un travail ajouté depuis l'administration survit.

INSERT INTO public.marketplace_work_items
  (key, label, family, role, requires_study, hint, sort_order)
VALUES
  ('reemboitage', 'Réemboîtage', 'repair', 'structure', false, 'Remettre le corps d''ouvrage dans sa couverture d''origine.', 10),
  ('reparation_dos', 'Réparation du dos', 'repair', 'complement', false, NULL, 20),
  ('reparation_mors', 'Réparation des mors', 'repair', 'complement', false, NULL, 30),
  ('reparation_coiffes', 'Réparation des coiffes', 'repair', 'complement', false, NULL, 40),
  ('reparation_coins', 'Réparation des coins', 'repair', 'complement', false, NULL, 50),
  ('reparation_plats', 'Reprise des plats', 'repair', 'complement', false, NULL, 60),
  ('pages_detachees', 'Pages détachées à remonter', 'repair', 'complement', false, NULL, 70),
  ('couture_partielle', 'Couture partielle', 'repair', 'complement', false, 'Reprendre quelques cahiers désolidarisés.', 80),
  ('recouture_complete', 'Recouture complète', 'repair', 'complement', false, 'Démonter et recoudre l''ensemble des cahiers.', 90),
  ('reparation_papier', 'Réparation du papier', 'repair', 'complement', false, NULL, 100),
  ('gardes_neuves', 'Gardes neuves', 'repair', 'complement', false, NULL, 110),
  ('pleine_toile', 'Pleine toile', 'cloth', 'structure', false, NULL, 120),
  ('demi_toile', 'Demi-toile', 'cloth', 'structure', false, NULL, 130),
  ('dos_cuir', 'Dos cuir', 'leather', 'structure', false, NULL, 140),
  ('demi_cuir', 'Demi-cuir', 'leather', 'structure', false, NULL, 150),
  ('demi_cuir_a_coins', 'Demi-cuir à coins', 'leather', 'structure', false, NULL, 160),
  ('plein_cuir', 'Plein cuir', 'leather', 'structure', false, NULL, 170),
  ('dorure_titrage', 'Titrage', 'gilding', 'complement', false, NULL, 180),
  ('dorure_auteur', 'Nom d''auteur', 'gilding', 'complement', false, NULL, 190),
  ('dorure_tomaison', 'Tomaison', 'gilding', 'complement', false, NULL, 200),
  ('dorure_date', 'Date', 'gilding', 'complement', false, NULL, 210),
  ('dorure_initiales', 'Initiales', 'gilding', 'complement', false, NULL, 220),
  ('dorure_filets', 'Filets', 'gilding', 'complement', false, NULL, 230),
  ('dorure_fleurons', 'Fleurons', 'gilding', 'complement', false, NULL, 240),
  ('dorure_decor', 'Décor doré', 'gilding', 'complement', false, 'Composition dorée, au-delà des fers isolés.', 250),
  ('nerfs', 'Nerfs', 'finishing', 'complement', false, NULL, 260),
  ('gardes_decorees', 'Gardes décorées', 'finishing', 'complement', false, NULL, 270),
  ('papiers_marbres', 'Papiers marbrés', 'finishing', 'complement', false, NULL, 280),
  ('mosaique', 'Mosaïque de cuir', 'finishing', 'complement', false, NULL, 290),
  ('signet', 'Signet', 'finishing', 'complement', false, NULL, 300),
  ('tranches', 'Tranches (dorées, jaspées, peintes)', 'finishing', 'complement', false, NULL, 310),
  ('decor_personnalise', 'Décor personnalisé', 'finishing', 'complement', false, NULL, 320),
  ('etui', 'Étui', 'protection', 'structure', false, NULL, 330),
  ('chemise', 'Chemise', 'protection', 'structure', false, NULL, 340),
  ('boite', 'Boîte', 'protection', 'structure', false, NULL, 350),
  ('coffret', 'Coffret', 'protection', 'structure', false, NULL, 360),
  ('restauration_cuir', 'Restauration du cuir existant', 'restoration', 'structure', false, NULL, 370),
  ('restauration_papier', 'Restauration du papier', 'restoration', 'complement', false, NULL, 380),
  ('restauration_cartonnage', 'Restauration du cartonnage', 'restoration', 'structure', false, NULL, 390),
  ('restauration_reliure_ancienne', 'Restauration d''une reliure ancienne', 'restoration', 'structure', false, NULL, 400),
  ('restauration_patrimoniale', 'Restauration patrimoniale', 'restoration', 'structure', true, 'Sur étude. Ne se chiffre jamais sur catalogue.', 410),
  ('rebind_collector', 'Rebind collector', 'creation', 'structure', false, NULL, 420),
  ('nouvelle_couverture', 'Nouvelle couverture', 'creation', 'structure', false, NULL, 430),
  ('reliure_de_creation', 'Reliure de création', 'creation', 'structure', true, 'Pièce unique dessinée avec le client. Sur étude.', 440),
  ('projet_sur_mesure', 'Projet sur mesure', 'creation', 'structure', true, NULL, 450)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  family = EXCLUDED.family,
  role = EXCLUDED.role,
  requires_study = EXCLUDED.requires_study,
  hint = EXCLUDED.hint,
  sort_order = EXCLUDED.sort_order;

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- DROP TABLE IF EXISTS public.marketplace_pricebook;
-- DROP TABLE IF EXISTS public.marketplace_binder_rates;
-- DROP TABLE IF EXISTS public.marketplace_work_items;
-- ALTER TABLE public.marketplace_case_matches
--   DROP COLUMN IF EXISTS minimum_required_payout_cents;
-- ALTER TABLE public.marketplace_cases
--   DROP COLUMN IF EXISTS pricing_components,
--   DROP COLUMN IF EXISTS pricing_low_estimate_cents,
--   DROP COLUMN IF EXISTS pricing_high_estimate_cents,
--   DROP COLUMN IF EXISTS pricing_reference_count;
-- ALTER TABLE public.marketplace_cases
--   DROP CONSTRAINT IF EXISTS marketplace_cases_pricing_status_check;
-- ALTER TABLE public.marketplace_cases
--   ADD CONSTRAINT marketplace_cases_pricing_status_check
--     CHECK (pricing_status IN ('pending', 'suggested', 'validated'));
