-- Ma Reliure — une seule grille tarifaire, la sienne.
--
-- Décision produit du 10 septembre 2026 : les ateliers n'ont pas de grille dans
-- Ma Reliure. Ma Reliure fixe ses prix, opération par opération, à partir d'une
-- recherche web initiale, et propose ensuite une rémunération à l'atelier
-- retenu. Il n'existe plus que deux objets :
--
--   marketplace_web_benchmarks   ce que notre recherche a trouvé en ligne (repère)
--   marketplace_pricebook        le prix que Ma Reliure utilise            (décision)
--
-- Cette migration est additive et rejouable. Rien n'est supprimé :
--
-- - `marketplace_binder_rates` et `marketplace_price_benchmarks` restent en
--   base, dépréciées, sans plus aucun code actif qui les lise ou les écrive.
--   Leur suppression appartiendra à une migration de nettoyage ultérieure ;
-- - `marketplace_publish_pricebook_entry` reste en place, inutilisée ;
-- - les dossiers existants gardent leur photographie de prix.
--
-- Aucune politique `build_*` n'est touchée. Rollback en fin de fichier.

-- ---------------------------------------------------------------------------
-- 1. Ce qui ne sert plus
-- ---------------------------------------------------------------------------

COMMENT ON TABLE public.marketplace_binder_rates IS
  'DÉPRÉCIÉE le 2026-09-10 : les ateliers n''ont plus de grille tarifaire dans Ma Reliure. Conservée pour l''historique ; aucun code actif ne la lit ni ne l''écrit.';

COMMENT ON TABLE public.marketplace_price_benchmarks IS
  'DÉPRÉCIÉE le 2026-09-10 : remplacée par marketplace_web_benchmarks (une ligne par opération). Relevés sourcés conservés pour l''historique.';

COMMENT ON FUNCTION public.marketplace_publish_pricebook_entry(
  TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, TEXT, INTEGER, INTEGER,
  INTEGER, INTEGER, TEXT[], BOOLEAN, INTEGER, TEXT, TEXT, UUID
) IS 'DÉPRÉCIÉE le 2026-09-10 : remplacée par marketplace_save_pricebook_changes.';

-- ---------------------------------------------------------------------------
-- 2. Benchmark web : une ligne par opération
-- ---------------------------------------------------------------------------
-- Montants en centimes TTC. `web_reference_cents` est la valeur centrale de
-- départ : le milieu des fourchettes observées, arrondi aux 5 €. Ce n'est pas
-- une moyenne statistique du marché — les sources sont trop peu nombreuses et
-- trop dispersées pour cela — et l'interface l'appelle « Référence web ».
--
-- Jamais public, jamais lu par le moteur une fois le prix Ma Reliure fixé : il
-- sert à initialiser la grille et à situer nos prix.

CREATE TABLE IF NOT EXISTS public.marketplace_web_benchmarks (
  work_item_key TEXT PRIMARY KEY REFERENCES public.marketplace_work_items(key),
  web_min_cents INTEGER,
  web_reference_cents INTEGER,
  web_max_cents INTEGER,
  pricing_unit TEXT NOT NULL DEFAULT 'per_book',
  open_ended_max BOOLEAN NOT NULL DEFAULT false,
  source_summary TEXT,
  researched_at DATE,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.marketplace_web_benchmarks
  DROP CONSTRAINT IF EXISTS marketplace_web_benchmarks_amounts_check,
  DROP CONSTRAINT IF EXISTS marketplace_web_benchmarks_unit_check,
  DROP CONSTRAINT IF EXISTS marketplace_web_benchmarks_open_ended_check;

ALTER TABLE public.marketplace_web_benchmarks
  ADD CONSTRAINT marketplace_web_benchmarks_amounts_check CHECK (
    (web_reference_cents IS NULL AND web_min_cents IS NULL AND web_max_cents IS NULL)
    OR (
      web_reference_cents > 0
      AND (web_min_cents IS NULL OR (web_min_cents > 0 AND web_min_cents <= web_reference_cents))
      AND (web_max_cents IS NULL OR web_max_cents >= web_reference_cents)
    )
  ),
  ADD CONSTRAINT marketplace_web_benchmarks_unit_check
    CHECK (pricing_unit IN ('per_book', 'per_hour')),
  ADD CONSTRAINT marketplace_web_benchmarks_open_ended_check
    CHECK (NOT open_ended_max OR web_max_cents IS NOT NULL);

ALTER TABLE public.marketplace_web_benchmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_web_benchmarks"
  ON public.marketplace_web_benchmarks;
CREATE POLICY "No direct access to marketplace_web_benchmarks"
  ON public.marketplace_web_benchmarks FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- La recherche initiale. `DO NOTHING` : un rejeu n'écrase jamais un repère
-- corrigé depuis l'administration.
INSERT INTO public.marketplace_web_benchmarks
  (work_item_key, web_min_cents, web_reference_cents, web_max_cents, pricing_unit, open_ended_max, source_summary, researched_at, notes)
VALUES
  -- Réparation / corps du livre
  ('reemboitage', 4000, 9500, 15000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('reparation_dos', 7000, 14500, 22000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('reparation_mors', 12000, 23500, 35000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('reparation_coiffes', 8000, 16500, 25000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('reparation_coins', 2500, 5000, 7000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('reparation_plats', 6000, 10500, 15000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('pages_detachees', 4000, 7500, 11000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('couture_partielle', 6000, 10500, 15000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('recouture_complete', 20000, 35000, 50000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('reparation_papier', 4000, 9500, 15000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('gardes_neuves', 5000, 8500, 12000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  -- Reliure toile
  ('pleine_toile', 12000, 18000, 24000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('demi_toile', 11000, 16500, 22000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  -- Reliure cuir
  ('dos_cuir', 18000, 26500, 35000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('demi_cuir', 25000, 35000, 45000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('demi_cuir_a_coins', 30000, 42500, 55000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('plein_cuir', 38000, 59000, 80000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  -- Dorure
  ('dorure_titrage', 2500, 5000, 7000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('dorure_auteur', 1500, 3000, 4000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('dorure_tomaison', 1500, 2500, 3500, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('dorure_date', 1500, 2500, 3500, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('dorure_initiales', 2000, 3500, 5000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('dorure_filets', 3000, 6500, 10000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('dorure_fleurons', 3000, 6500, 10000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('dorure_decor', 10000, 25000, 40000, 'per_book', true, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  -- Finitions
  ('nerfs', 4000, 8000, 12000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('gardes_decorees', 3000, 6000, 9000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('papiers_marbres', 3000, 6500, 10000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('mosaique', 15000, 47500, 80000, 'per_book', true, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('signet', 1000, 2000, 3000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('tranches', 5000, 15000, 25000, 'per_book', true, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('decor_personnalise', 10000, 35000, 60000, 'per_book', true, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  -- Protection
  ('etui', 8000, 13000, 18000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('chemise', 13000, 23500, 34000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('boite', 10000, 20000, 30000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('coffret', 18000, 34000, 50000, 'per_book', true, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  -- Restauration
  ('restauration_cuir', 15000, 32500, 50000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('restauration_papier', 5000, 15000, 25000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('restauration_cartonnage', 9000, 19500, 30000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('restauration_reliure_ancienne', 20000, 40000, 60000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('restauration_patrimoniale', NULL, 8500, NULL, 'per_hour', false, 'Référence horaire interne Ma Reliure, non issue du web.', '2026-09-10', 'Taux horaire indicatif. Ne jamais en déduire automatiquement le prix total d''une restauration patrimoniale : sur étude.'),
  -- Création
  ('rebind_collector', 18000, 31500, 45000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers et offres rebind / collector sur Etsy.', '2026-09-10', NULL),
  ('nouvelle_couverture', 10000, 20000, 30000, 'per_book', false, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', NULL),
  ('reliure_de_creation', 150000, 250000, 350000, 'per_book', true, 'Recherche initiale Ma Reliure : tarifs publics d''ateliers (notamment Les Reliures de Châtillon, Bourgogne Reliure, Atelier Devauchelle, AMP Reliures).', '2026-09-10', 'Référence indicative. Pièce unique : toujours sur étude.'),
  ('projet_sur_mesure', NULL, NULL, NULL, 'per_book', false, NULL, '2026-09-10', 'Pas de montant automatique suffisamment fiable : sur étude.')
ON CONFLICT (work_item_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. La politique de rémunération des ateliers
-- ---------------------------------------------------------------------------
-- Une seule règle, administrable : la marge que Ma Reliure garde sur le prix
-- HT d'un projet, en part et en euros. La rémunération proposée à l'atelier en
-- découle. Valeurs initiales données par Ma Reliure : 25 % et 80 €.

CREATE TABLE IF NOT EXISTS public.marketplace_pricing_policy (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  target_margin_bps INTEGER NOT NULL,
  minimum_margin_cents INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.marketplace_pricing_policy
  DROP CONSTRAINT IF EXISTS marketplace_pricing_policy_singleton_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricing_policy_values_check;

ALTER TABLE public.marketplace_pricing_policy
  ADD CONSTRAINT marketplace_pricing_policy_singleton_check CHECK (id = 1),
  ADD CONSTRAINT marketplace_pricing_policy_values_check CHECK (
    target_margin_bps BETWEEN 0 AND 9000 AND minimum_margin_cents >= 0
  );

ALTER TABLE public.marketplace_pricing_policy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_pricing_policy"
  ON public.marketplace_pricing_policy;
CREATE POLICY "No direct access to marketplace_pricing_policy"
  ON public.marketplace_pricing_policy FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

INSERT INTO public.marketplace_pricing_policy (id, target_margin_bps, minimum_margin_cents)
VALUES (1, 2500, 8000)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Modificateurs : « revue manuelle » devient une valeur possible
-- ---------------------------------------------------------------------------
-- Un modificateur s'applique désormais au total du projet, après addition des
-- opérations. Le hors format part en revue manuelle par défaut : c'est la
-- seule valeur posée ici, et ce n'est pas un montant.

ALTER TABLE public.marketplace_pricing_modifiers
  DROP CONSTRAINT IF EXISTS marketplace_pricing_modifiers_kind_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricing_modifiers_value_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricing_modifiers_enabled_check;

ALTER TABLE public.marketplace_pricing_modifiers
  ADD CONSTRAINT marketplace_pricing_modifiers_kind_check
    CHECK (kind IN ('PERCENT', 'FIXED', 'MANUAL_REVIEW')),
  ADD CONSTRAINT marketplace_pricing_modifiers_value_check CHECK (
    (kind = 'PERCENT' AND fixed_cents IS NULL
      AND (percent_bps IS NULL OR percent_bps BETWEEN -9000 AND 50000))
    OR (kind = 'FIXED' AND percent_bps IS NULL)
    OR (kind = 'MANUAL_REVIEW' AND percent_bps IS NULL AND fixed_cents IS NULL)
  ),
  ADD CONSTRAINT marketplace_pricing_modifiers_enabled_check CHECK (
    NOT enabled OR kind = 'MANUAL_REVIEW' OR percent_bps IS NOT NULL OR fixed_cents IS NOT NULL
  );

UPDATE public.marketplace_pricing_modifiers
SET kind = 'MANUAL_REVIEW',
    enabled = true,
    notes = 'Hors format : revue manuelle par défaut.'
WHERE axis = 'size'
  AND class_key = 'oversize'
  AND enabled = false
  AND percent_bps IS NULL
  AND fixed_cents IS NULL
  AND updated_by IS NULL;

-- ---------------------------------------------------------------------------
-- 5. Pricebook : une entrée active par opération, avec sa provenance
-- ---------------------------------------------------------------------------
-- `status` :
--   draft      en vigueur, non validé    provenance WEB_REFERENCE_INITIAL
--   published  en vigueur, validé        provenance ADMIN_VALIDATED
--   retired    version remplacée, gardée pour l'historique
--
-- Le prix Ma Reliure est décidé TTC (`customer_price_ttc_cents`) : c'est ainsi
-- qu'il se lit sur le web et qu'un particulier le paie. Le HT
-- (`customer_price_cents`) en est déduit par `vat.ts` et sert au calcul de la
-- marge. `reference_binder_payout_cents` n'est plus écrit : la rémunération se
-- calcule sur le projet entier, par la politique ci-dessus.
--
-- Format et complexité ne multiplient plus les lignes : toute entrée active est
-- en classe courante, les écarts passent par les modificateurs.

ALTER TABLE public.marketplace_pricebook
  ADD COLUMN IF NOT EXISTS provenance TEXT NOT NULL DEFAULT 'ADMIN_VALIDATED';

-- Ce qui ne peut pas rester en vigueur dans le nouveau modèle est retiré, pas
-- effacé : une entrée hors classe courante, un brouillon de l'ancien modèle.
UPDATE public.marketplace_pricebook
SET status = 'retired'
WHERE status IN ('draft', 'published')
  AND (size_class <> 'standard' OR complexity_class <> 'standard');

UPDATE public.marketplace_pricebook
SET status = 'retired'
WHERE status = 'draft' AND provenance <> 'WEB_REFERENCE_INITIAL';

ALTER TABLE public.marketplace_pricebook
  DROP CONSTRAINT IF EXISTS marketplace_pricebook_amounts_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricebook_history_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricebook_public_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricebook_provenance_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricebook_status_provenance_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricebook_grid_class_check;

ALTER TABLE public.marketplace_pricebook
  ADD CONSTRAINT marketplace_pricebook_amounts_check CHECK (
    (pricing_mode = 'MANUAL_REVIEW'
      AND customer_price_cents IS NULL
      AND customer_price_ttc_cents IS NULL
      AND reference_binder_payout_cents IS NULL)
    OR (pricing_mode <> 'MANUAL_REVIEW'
      AND customer_price_cents > 0
      AND customer_price_ttc_cents >= customer_price_cents
      AND (reference_binder_payout_cents IS NULL
        OR reference_binder_payout_cents <= customer_price_cents))
  ),
  ADD CONSTRAINT marketplace_pricebook_provenance_check
    CHECK (provenance IN ('WEB_REFERENCE_INITIAL', 'ADMIN_VALIDATED')),
  ADD CONSTRAINT marketplace_pricebook_status_provenance_check CHECK (
    status = 'retired'
    OR (status = 'draft' AND provenance = 'WEB_REFERENCE_INITIAL')
    OR (status = 'published' AND provenance = 'ADMIN_VALIDATED')
  ),
  ADD CONSTRAINT marketplace_pricebook_grid_class_check CHECK (
    status = 'retired' OR (size_class = 'standard' AND complexity_class = 'standard')
  ),
  -- Rien n'est public sans avoir été validé par Ma Reliure.
  ADD CONSTRAINT marketplace_pricebook_public_check CHECK (
    NOT public_visible
    OR (provenance = 'ADMIN_VALIDATED'
      AND pricing_mode <> 'MANUAL_REVIEW'
      AND customer_price_ttc_cents IS NOT NULL)
  );

-- Une seule entrée en vigueur par opération, validée ou non.
DROP INDEX IF EXISTS public.marketplace_pricebook_published_unique;
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_pricebook_active_unique
  ON public.marketplace_pricebook(work_item_key)
  WHERE status IN ('draft', 'published');
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_pricebook_version_unique
  ON public.marketplace_pricebook(work_item_key, size_class, complexity_class, version);

-- La grille initiale : prix Ma Reliure = référence web, en brouillon. Seulement
-- pour une opération qui n'a encore aucune entrée en vigueur : un rejeu ne
-- crée pas de doublon et n'écrase aucun prix décidé.
--
-- Le HT est déduit du TTC par la même division arrondie que `fromTtc`
-- (vat.ts) : floor((2 × TTC × 10 000 + d) / 2d), d = 10 000 + taux.
INSERT INTO public.marketplace_pricebook (
  work_item_key, size_class, complexity_class, pricing_mode, pricing_method,
  reference_binder_payout_cents, customer_price_cents, customer_price_ttc_cents, vat_rate_bps,
  target_margin_bps, target_margin_cents, version, status, provenance, notes
)
SELECT
  b.work_item_key,
  'standard',
  'standard',
  CASE WHEN w.requires_study THEN 'MANUAL_REVIEW' ELSE 'FIXED' END,
  'fixed_price',
  NULL,
  CASE WHEN w.requires_study THEN NULL
    ELSE ((2::bigint * b.web_reference_cents * 10000 + 12000) / (2 * 12000))::integer END,
  CASE WHEN w.requires_study THEN NULL ELSE b.web_reference_cents END,
  2000,
  coalesce((SELECT target_margin_bps FROM public.marketplace_pricing_policy WHERE id = 1), 0),
  NULL,
  coalesce((
    SELECT max(p.version) FROM public.marketplace_pricebook p
    WHERE p.work_item_key = b.work_item_key
      AND p.size_class = 'standard' AND p.complexity_class = 'standard'
  ), 0) + 1,
  'draft',
  'WEB_REFERENCE_INITIAL',
  'Initialisé depuis la référence web.'
FROM public.marketplace_web_benchmarks b
JOIN public.marketplace_work_items w ON w.key = b.work_item_key
WHERE (w.requires_study OR b.web_reference_cents IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM public.marketplace_pricebook p
    WHERE p.work_item_key = b.work_item_key AND p.status IN ('draft', 'published')
  );

-- ---------------------------------------------------------------------------
-- 6. Enregistrer des changements de grille, atomiquement
-- ---------------------------------------------------------------------------
-- Un appel, une transaction, plusieurs opérations : modifier un prix, valider
-- une référence initiale, revenir à la référence web, rendre un prix public.
-- Chaque changement retire la version en vigueur et en écrit une nouvelle, avec
-- son événement. Les montants arrivent calculés par le code (vat.ts) ; la base
-- garantit la cohérence, le versionnage et la concurrence : une ligne modifiée
-- par quelqu'un d'autre depuis l'ouverture de la grille est refusée.

CREATE OR REPLACE FUNCTION public.marketplace_save_pricebook_changes(
  p_changes JSONB,
  p_change_reason TEXT,
  p_actor_user_id UUID
) RETURNS SETOF public.marketplace_pricebook
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  change JSONB;
  v_key TEXT;
  v_status TEXT;
  v_mode TEXT;
  v_expected TEXT;
  v_study BOOLEAN;
  current_entry public.marketplace_pricebook;
  next_version INTEGER;
  inserted public.marketplace_pricebook;
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'A pricebook change is always made by someone.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'array'
     OR jsonb_array_length(p_changes) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Between 1 and 100 changes are expected.'
      USING ERRCODE = 'check_violation';
  END IF;

  FOR change IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
    v_key := change ->> 'work_item_key';
    v_status := change ->> 'status';
    v_mode := change ->> 'pricing_mode';
    v_expected := coalesce(change ->> 'expected_entry_id', '');

    IF v_status NOT IN ('draft', 'published') THEN
      RAISE EXCEPTION 'Unknown pricebook status %.', v_status USING ERRCODE = 'check_violation';
    END IF;

    SELECT requires_study INTO v_study FROM public.marketplace_work_items WHERE key = v_key;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unknown work item %.', v_key USING ERRCODE = 'check_violation';
    END IF;
    IF v_study AND v_mode <> 'MANUAL_REVIEW' THEN
      RAISE EXCEPTION '% is priced on study only.', v_key USING ERRCODE = 'check_violation';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('marketplace_pricebook:' || v_key));

    SELECT * INTO current_entry
    FROM public.marketplace_pricebook
    WHERE work_item_key = v_key AND status IN ('draft', 'published')
    LIMIT 1;

    IF coalesce(current_entry.id::text, '') <> v_expected THEN
      RAISE EXCEPTION 'The price of % changed since the grid was opened: reload it.', v_key
        USING ERRCODE = 'serialization_failure';
    END IF;

    SELECT coalesce(max(version), 0) + 1 INTO next_version
    FROM public.marketplace_pricebook
    WHERE work_item_key = v_key AND size_class = 'standard' AND complexity_class = 'standard';

    UPDATE public.marketplace_pricebook SET status = 'retired' WHERE id = current_entry.id;

    INSERT INTO public.marketplace_pricebook (
      work_item_key, size_class, complexity_class, pricing_mode, pricing_method,
      reference_binder_payout_cents, customer_price_cents, customer_price_ttc_cents,
      vat_rate_bps, target_margin_bps, target_margin_cents, public_visible, provenance,
      version, status, validated_at, validated_by, created_by, change_reason, notes
    ) VALUES (
      v_key, 'standard', 'standard', v_mode, 'fixed_price',
      NULL,
      (change ->> 'customer_price_cents')::integer,
      (change ->> 'customer_price_ttc_cents')::integer,
      coalesce((change ->> 'vat_rate_bps')::integer, 2000),
      coalesce((SELECT target_margin_bps FROM public.marketplace_pricing_policy WHERE id = 1), 0),
      NULL,
      coalesce((change ->> 'public_visible')::boolean, false),
      change ->> 'provenance',
      next_version,
      v_status,
      CASE WHEN v_status = 'published' THEN now() END,
      CASE WHEN v_status = 'published' THEN p_actor_user_id END,
      p_actor_user_id,
      nullif(btrim(coalesce(p_change_reason, '')), ''),
      current_entry.notes
    )
    RETURNING * INTO inserted;

    INSERT INTO public.marketplace_events(case_id, actor_user_id, event_type, metadata)
    VALUES (
      NULL,
      p_actor_user_id,
      'pricebook_updated',
      jsonb_build_object(
        'pricebook_entry_id', inserted.id,
        'work_item_key', v_key,
        'action', change ->> 'action',
        'version', next_version,
        'previous_version', current_entry.version,
        'previous_price_ttc_cents', current_entry.customer_price_ttc_cents,
        'price_ttc_cents', inserted.customer_price_ttc_cents,
        'previous_provenance', current_entry.provenance,
        'provenance', inserted.provenance,
        'pricing_mode', inserted.pricing_mode,
        'public_visible', inserted.public_visible,
        'change_reason', inserted.change_reason
      )
    );

    RETURN NEXT inserted;
  END LOOP;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.marketplace_save_pricebook_changes(JSONB, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_save_pricebook_changes(JSONB, TEXT, UUID)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- À n'exécuter qu'avant la première validation de la grille : les versions
-- écrites depuis portent une provenance que l'ancien modèle ne connaît pas.
--
-- DROP FUNCTION IF EXISTS public.marketplace_save_pricebook_changes(JSONB, TEXT, UUID);
-- DELETE FROM public.marketplace_pricebook WHERE provenance = 'WEB_REFERENCE_INITIAL';
-- DROP INDEX IF EXISTS public.marketplace_pricebook_version_unique;
-- DROP INDEX IF EXISTS public.marketplace_pricebook_active_unique;
-- CREATE UNIQUE INDEX IF NOT EXISTS marketplace_pricebook_published_unique
--   ON public.marketplace_pricebook(work_item_key, size_class, complexity_class)
--   WHERE status = 'published';
-- ALTER TABLE public.marketplace_pricebook
--   DROP CONSTRAINT IF EXISTS marketplace_pricebook_grid_class_check,
--   DROP CONSTRAINT IF EXISTS marketplace_pricebook_status_provenance_check,
--   DROP CONSTRAINT IF EXISTS marketplace_pricebook_provenance_check,
--   DROP COLUMN IF EXISTS provenance;
--   (reposer amounts_check, public_check et history_check de 20260910120000)
-- UPDATE public.marketplace_pricing_modifiers SET kind = 'PERCENT', enabled = false, notes = NULL
--   WHERE kind = 'MANUAL_REVIEW';
--   (reposer kind_check, value_check et enabled_check de 20260910120000)
-- DROP TABLE IF EXISTS public.marketplace_pricing_policy;
-- DROP TABLE IF EXISTS public.marketplace_web_benchmarks;
-- COMMENT ON TABLE public.marketplace_binder_rates IS NULL;
-- COMMENT ON TABLE public.marketplace_price_benchmarks IS NULL;
