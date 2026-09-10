-- Ma Reliure — la console d'administration des prix.
--
-- Trois couches, qui ne se mélangent jamais :
--
--   marketplace_price_benchmarks   ce que le web affiche          (repère)
--   marketplace_binder_rates       ce que chaque relieur demande  (observation)
--   marketplace_pricebook          ce que Ma Reliure paie et vend (décision)
--
-- Cette migration n'ajoute pas de second catalogue : chaque nouvelle ligne
-- pointe vers `marketplace_work_items`. Elle est additive — aucune table,
-- aucune colonne supprimée — et rejouable : chaque objet est créé sous garde,
-- chaque contrainte retirée avant d'être reposée. Rollback en fin de fichier.
--
-- Aucune politique `build_*` n'est touchée.

-- ---------------------------------------------------------------------------
-- 1. Provenances des grilles
-- ---------------------------------------------------------------------------
-- Une ligne saisie sans que le relieur l'ait confirmée n'est pas « validée par
-- Ma Reliure » : c'est une déclaration. `BINDER_DECLARED` le dit, et ne compte
-- dans aucune médiane. `HISTORICAL_TRANSACTION` est un montant réellement
-- payé, donc lié à une commande.
--
-- `WEB_BENCHMARK` n'est volontairement PAS admis ici : un prix lu sur un site
-- ne peut pas devenir une grille d'atelier, même par erreur de saisie.

ALTER TABLE public.marketplace_binder_rates
  DROP CONSTRAINT IF EXISTS marketplace_binder_rates_provenance_check,
  DROP CONSTRAINT IF EXISTS marketplace_binder_rates_historical_check;

ALTER TABLE public.marketplace_binder_rates
  ADD CONSTRAINT marketplace_binder_rates_provenance_check CHECK (provenance IN (
    'REAL_VERIFIED', 'HISTORICAL_TRANSACTION', 'ADMIN_VALIDATED', 'BINDER_DECLARED',
    'DEMO', 'PLACEHOLDER', 'TEST_ONLY'
  )),
  ADD CONSTRAINT marketplace_binder_rates_historical_check CHECK (
    provenance <> 'HISTORICAL_TRANSACTION' OR source = 'historical_order'
  );

-- ---------------------------------------------------------------------------
-- 2. Catalogue : qui a modifié quoi
-- ---------------------------------------------------------------------------

ALTER TABLE public.marketplace_work_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 3. Benchmark marché
-- ---------------------------------------------------------------------------
-- Un prix affiché publiquement par un atelier, relevé à une date, avec la page
-- et l'extrait qui le prouvent. Un repère pour situer le Pricebook — jamais
-- un prix Ma Reliure, jamais une référence d'atelier, jamais public.
--
-- Format et complexité sont nullables : beaucoup de sites ne les précisent
-- pas, et attribuer une classe à un prix qui n'en donne pas serait inventer.

CREATE TABLE IF NOT EXISTS public.marketplace_price_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_key TEXT NOT NULL REFERENCES public.marketplace_work_items(key),
  size_class TEXT,
  complexity_class TEXT,
  low_price_cents INTEGER NOT NULL,
  high_price_cents INTEGER NOT NULL,
  unit_label TEXT,
  price_basis TEXT NOT NULL DEFAULT 'NOT_STATED',
  format_label TEXT,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_excerpt TEXT NOT NULL,
  observed_at DATE NOT NULL,
  provenance TEXT NOT NULL DEFAULT 'WEB_BENCHMARK',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.marketplace_price_benchmarks
  DROP CONSTRAINT IF EXISTS marketplace_price_benchmarks_amounts_check,
  DROP CONSTRAINT IF EXISTS marketplace_price_benchmarks_size_check,
  DROP CONSTRAINT IF EXISTS marketplace_price_benchmarks_complexity_check,
  DROP CONSTRAINT IF EXISTS marketplace_price_benchmarks_basis_check,
  DROP CONSTRAINT IF EXISTS marketplace_price_benchmarks_provenance_check,
  DROP CONSTRAINT IF EXISTS marketplace_price_benchmarks_status_check,
  DROP CONSTRAINT IF EXISTS marketplace_price_benchmarks_source_check;

ALTER TABLE public.marketplace_price_benchmarks
  ADD CONSTRAINT marketplace_price_benchmarks_amounts_check CHECK (
    low_price_cents > 0 AND low_price_cents <= high_price_cents
  ),
  ADD CONSTRAINT marketplace_price_benchmarks_size_check CHECK (
    size_class IS NULL OR size_class IN ('small', 'standard', 'large', 'oversize')
  ),
  ADD CONSTRAINT marketplace_price_benchmarks_complexity_check CHECK (
    complexity_class IS NULL OR complexity_class IN ('simple', 'standard', 'complex')
  ),
  ADD CONSTRAINT marketplace_price_benchmarks_basis_check
    CHECK (price_basis IN ('TTC', 'HT', 'NOT_STATED')),
  -- La contrainte qui porte la séparation : cette table ne contient que du
  -- repère web. Rien d'autre ne peut y entrer, et rien d'ici ne se vend.
  ADD CONSTRAINT marketplace_price_benchmarks_provenance_check
    CHECK (provenance = 'WEB_BENCHMARK'),
  ADD CONSTRAINT marketplace_price_benchmarks_status_check
    CHECK (status IN ('active', 'retired')),
  -- Sans page ni extrait, un repère n'est qu'un chiffre de plus.
  ADD CONSTRAINT marketplace_price_benchmarks_source_check CHECK (
    source_url ~ '^https?://'
    AND length(btrim(source_name)) > 0
    AND length(btrim(source_excerpt)) BETWEEN 1 AND 400
  );

CREATE INDEX IF NOT EXISTS marketplace_price_benchmarks_work_item_idx
  ON public.marketplace_price_benchmarks(work_item_key)
  WHERE status = 'active';

-- Le même relevé ne s'enregistre pas deux fois : le seed est rejouable.
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_price_benchmarks_observation_unique
  ON public.marketplace_price_benchmarks(
    work_item_key,
    coalesce(size_class, ''),
    coalesce(complexity_class, ''),
    source_url,
    coalesce(format_label, ''),
    coalesce(unit_label, '')
  )
  WHERE status = 'active';

ALTER TABLE public.marketplace_price_benchmarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_price_benchmarks"
  ON public.marketplace_price_benchmarks;
CREATE POLICY "No direct access to marketplace_price_benchmarks"
  ON public.marketplace_price_benchmarks FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 4. Pricebook : HT, TVA, TTC, mode, composition, historique
-- ---------------------------------------------------------------------------
-- `customer_price_cents` est désormais le prix client **HT**. La table était
-- vide dans les deux bases au moment de cette migration : aucune ligne ne
-- change de sens. La TVA et le TTC sont calculés par `vat.ts` et figés à la
-- publication, pour qu'une entrée dise exactement ce qu'elle affichait.
--
-- `target_margin_bps` devient la marge **visée** ; la marge réelle se déduit
-- du prix et de la rémunération. `target_margin_cents`, qui en portait une
-- copie, n'est plus écrit et devient nullable (colonne historique conservée).
--
-- Un travail « sur étude » (`MANUAL_REVIEW`) n'a pas de montant : on ne
-- demande pas de chiffre à ce qui refuse d'en avoir un.

ALTER TABLE public.marketplace_pricebook
  ADD COLUMN IF NOT EXISTS pricing_mode TEXT NOT NULL DEFAULT 'FIXED',
  ADD COLUMN IF NOT EXISTS price_ht_high_cents INTEGER,
  ADD COLUMN IF NOT EXISTS unit_label TEXT,
  ADD COLUMN IF NOT EXISTS vat_rate_bps INTEGER NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS customer_price_ttc_cents INTEGER,
  ADD COLUMN IF NOT EXISTS minimum_margin_cents INTEGER,
  ADD COLUMN IF NOT EXISTS included_work_items TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS public_visible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS change_reason TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.marketplace_pricebook
  ALTER COLUMN reference_binder_payout_cents DROP NOT NULL,
  ALTER COLUMN customer_price_cents DROP NOT NULL,
  ALTER COLUMN target_margin_cents DROP NOT NULL;

ALTER TABLE public.marketplace_pricebook
  DROP CONSTRAINT IF EXISTS marketplace_pricebook_amounts_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricebook_mode_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricebook_range_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricebook_unit_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricebook_vat_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricebook_ttc_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricebook_minimum_margin_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricebook_target_margin_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricebook_history_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricebook_public_check;

ALTER TABLE public.marketplace_pricebook
  ADD CONSTRAINT marketplace_pricebook_amounts_check CHECK (
    (pricing_mode = 'MANUAL_REVIEW'
      AND customer_price_cents IS NULL
      AND reference_binder_payout_cents IS NULL)
    OR (pricing_mode <> 'MANUAL_REVIEW'
      AND reference_binder_payout_cents > 0
      AND customer_price_cents > 0
      AND reference_binder_payout_cents <= customer_price_cents)
  ),
  ADD CONSTRAINT marketplace_pricebook_mode_check CHECK (pricing_mode IN (
    'FIXED', 'RANGE', 'PER_UNIT', 'PER_HOUR', 'STARTING_FROM', 'MANUAL_REVIEW'
  )),
  ADD CONSTRAINT marketplace_pricebook_range_check CHECK (
    price_ht_high_cents IS NULL
    OR (pricing_mode = 'RANGE' AND price_ht_high_cents >= customer_price_cents)
  ),
  ADD CONSTRAINT marketplace_pricebook_unit_check CHECK (
    pricing_mode NOT IN ('PER_UNIT', 'PER_HOUR') OR unit_label IS NOT NULL
  ),
  ADD CONSTRAINT marketplace_pricebook_vat_check
    CHECK (vat_rate_bps BETWEEN 0 AND 10000),
  ADD CONSTRAINT marketplace_pricebook_ttc_check CHECK (
    customer_price_ttc_cents IS NULL
    OR (customer_price_cents IS NOT NULL AND customer_price_ttc_cents >= customer_price_cents)
  ),
  ADD CONSTRAINT marketplace_pricebook_minimum_margin_check
    CHECK (minimum_margin_cents IS NULL OR minimum_margin_cents >= 0),
  ADD CONSTRAINT marketplace_pricebook_target_margin_check
    CHECK (target_margin_bps BETWEEN 0 AND 9999),
  -- L'historique : une deuxième version dit pourquoi elle remplace la première.
  ADD CONSTRAINT marketplace_pricebook_history_check
    CHECK (version = 1 OR change_reason IS NOT NULL),
  -- Rien ne devient public sans prix TTC arrêté, et jamais un travail sur étude.
  ADD CONSTRAINT marketplace_pricebook_public_check CHECK (
    NOT public_visible
    OR (pricing_mode <> 'MANUAL_REVIEW' AND customer_price_ttc_cents IS NOT NULL)
  );

-- ---------------------------------------------------------------------------
-- 5. Modificateurs de format et de complexité
-- ---------------------------------------------------------------------------
-- Une décision de Ma Reliure, au même titre que la marge : « un grand format
-- coûte tant de plus ». Semés **désactivés et sans valeur** : le système ne
-- fixe aucun coefficient, il offre la case où un humain l'écrira. Une entrée
-- exacte du Pricebook l'emporte toujours sur un modificateur.

CREATE TABLE IF NOT EXISTS public.marketplace_pricing_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  axis TEXT NOT NULL,
  class_key TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'PERCENT',
  percent_bps INTEGER,
  fixed_cents INTEGER,
  enabled BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (axis, class_key)
);

ALTER TABLE public.marketplace_pricing_modifiers
  DROP CONSTRAINT IF EXISTS marketplace_pricing_modifiers_axis_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricing_modifiers_kind_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricing_modifiers_value_check,
  DROP CONSTRAINT IF EXISTS marketplace_pricing_modifiers_enabled_check;

ALTER TABLE public.marketplace_pricing_modifiers
  -- La classe courante est la base : elle n'a pas de modificateur.
  ADD CONSTRAINT marketplace_pricing_modifiers_axis_check CHECK (
    (axis = 'size' AND class_key IN ('small', 'large', 'oversize'))
    OR (axis = 'complexity' AND class_key IN ('simple', 'complex'))
  ),
  ADD CONSTRAINT marketplace_pricing_modifiers_kind_check
    CHECK (kind IN ('PERCENT', 'FIXED')),
  ADD CONSTRAINT marketplace_pricing_modifiers_value_check CHECK (
    (kind = 'PERCENT' AND fixed_cents IS NULL
      AND (percent_bps IS NULL OR percent_bps BETWEEN -9000 AND 50000))
    OR (kind = 'FIXED' AND percent_bps IS NULL)
  ),
  ADD CONSTRAINT marketplace_pricing_modifiers_enabled_check CHECK (
    NOT enabled OR percent_bps IS NOT NULL OR fixed_cents IS NOT NULL
  );

ALTER TABLE public.marketplace_pricing_modifiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_pricing_modifiers"
  ON public.marketplace_pricing_modifiers;
CREATE POLICY "No direct access to marketplace_pricing_modifiers"
  ON public.marketplace_pricing_modifiers FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- Les cases, vides. `DO NOTHING` : un rejeu n'écrase jamais une valeur posée
-- depuis l'administration.
INSERT INTO public.marketplace_pricing_modifiers (axis, class_key)
VALUES
  ('size', 'small'),
  ('size', 'large'),
  ('size', 'oversize'),
  ('complexity', 'simple'),
  ('complexity', 'complex')
ON CONFLICT (axis, class_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Le dossier fige son prix
-- ---------------------------------------------------------------------------
-- À la validation, le dossier garde une photographie complète : versions du
-- Pricebook, opérations, HT, TVA, TTC, marge, confiance, écart éventuel au
-- Pricebook. Une correction ultérieure du Pricebook ne réécrit jamais un prix
-- déjà annoncé à un client.

ALTER TABLE public.marketplace_cases
  ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS customer_price_ttc_cents INTEGER,
  ADD COLUMN IF NOT EXISTS pricing_vat_rate_bps INTEGER;

ALTER TABLE public.marketplace_cases
  DROP CONSTRAINT IF EXISTS marketplace_cases_pricing_snapshot_check,
  DROP CONSTRAINT IF EXISTS marketplace_cases_customer_price_ttc_check,
  DROP CONSTRAINT IF EXISTS marketplace_cases_pricing_vat_check;

ALTER TABLE public.marketplace_cases
  ADD CONSTRAINT marketplace_cases_pricing_snapshot_check CHECK (
    pricing_snapshot IS NULL OR jsonb_typeof(pricing_snapshot) = 'object'
  ),
  ADD CONSTRAINT marketplace_cases_customer_price_ttc_check CHECK (
    customer_price_ttc_cents IS NULL
    OR (customer_price_cents IS NOT NULL AND customer_price_ttc_cents >= customer_price_cents)
  ),
  ADD CONSTRAINT marketplace_cases_pricing_vat_check CHECK (
    pricing_vat_rate_bps IS NULL OR pricing_vat_rate_bps BETWEEN 0 AND 10000
  );

-- ---------------------------------------------------------------------------
-- 7. Des événements qui ne concernent pas un dossier
-- ---------------------------------------------------------------------------
-- Modifier le Pricebook ou une grille est un événement du référentiel, pas
-- d'un dossier. `case_id` devient facultatif ; les événements de dossier
-- existants le portent toujours.

ALTER TABLE public.marketplace_events
  ALTER COLUMN case_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS marketplace_events_type_idx
  ON public.marketplace_events(event_type, created_at DESC);

-- ---------------------------------------------------------------------------
-- 8. Publier une entrée de Pricebook, atomiquement
-- ---------------------------------------------------------------------------
-- Retirer l'ancienne version et écrire la nouvelle en deux appels laissait une
-- fenêtre sans prix publié si le second échouait. Ici tout se passe dans une
-- transaction, sérialisée par combinaison, avec son événement.
--
-- Aucune règle de marge n'y bloque quoi que ce soit : la marge est un signal
-- (OK / Attention / Alerte) affiché à la personne qui publie. Seules les
-- incohérences structurelles sont refusées, par les contraintes de la table.

CREATE OR REPLACE FUNCTION public.marketplace_publish_pricebook_entry(
  p_work_item_key TEXT,
  p_size_class TEXT,
  p_complexity_class TEXT,
  p_pricing_mode TEXT,
  p_pricing_method TEXT,
  p_reference_binder_payout_cents INTEGER,
  p_customer_price_cents INTEGER,
  p_price_ht_high_cents INTEGER,
  p_unit_label TEXT,
  p_vat_rate_bps INTEGER,
  p_customer_price_ttc_cents INTEGER,
  p_target_margin_bps INTEGER,
  p_minimum_margin_cents INTEGER,
  p_included_work_items TEXT[],
  p_public_visible BOOLEAN,
  p_reference_count INTEGER,
  p_notes TEXT,
  p_change_reason TEXT,
  p_actor_user_id UUID
) RETURNS public.marketplace_pricebook
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous public.marketplace_pricebook;
  next_version INTEGER;
  inserted public.marketplace_pricebook;
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'A pricebook entry is always published by someone.'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(
    'marketplace_pricebook:' || p_work_item_key || ':' || p_size_class || ':' || p_complexity_class
  ));

  SELECT * INTO previous
  FROM public.marketplace_pricebook
  WHERE work_item_key = p_work_item_key
    AND size_class = p_size_class
    AND complexity_class = p_complexity_class
  ORDER BY version DESC
  LIMIT 1;

  next_version := coalesce(previous.version, 0) + 1;

  IF next_version > 1 AND nullif(btrim(coalesce(p_change_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Changing a published price requires a reason.'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.marketplace_pricebook
  SET status = 'retired'
  WHERE work_item_key = p_work_item_key
    AND size_class = p_size_class
    AND complexity_class = p_complexity_class
    AND status = 'published';

  INSERT INTO public.marketplace_pricebook (
    work_item_key, size_class, complexity_class, pricing_mode, pricing_method,
    reference_binder_payout_cents, customer_price_cents, price_ht_high_cents, unit_label,
    vat_rate_bps, customer_price_ttc_cents, target_margin_bps, target_margin_cents,
    minimum_margin_cents, included_work_items, public_visible,
    reference_count_at_validation, notes, change_reason,
    version, status, validated_at, validated_by, created_by
  ) VALUES (
    p_work_item_key, p_size_class, p_complexity_class, p_pricing_mode, p_pricing_method,
    p_reference_binder_payout_cents, p_customer_price_cents, p_price_ht_high_cents, p_unit_label,
    p_vat_rate_bps, p_customer_price_ttc_cents, p_target_margin_bps, NULL,
    p_minimum_margin_cents, coalesce(p_included_work_items, '{}'), coalesce(p_public_visible, false),
    coalesce(p_reference_count, 0), p_notes, nullif(btrim(coalesce(p_change_reason, '')), ''),
    next_version, 'published', now(), p_actor_user_id, p_actor_user_id
  )
  RETURNING * INTO inserted;

  INSERT INTO public.marketplace_events(case_id, actor_user_id, event_type, metadata)
  VALUES (
    NULL,
    p_actor_user_id,
    'pricebook_updated',
    jsonb_build_object(
      'pricebook_entry_id', inserted.id,
      'work_item_key', p_work_item_key,
      'size_class', p_size_class,
      'complexity_class', p_complexity_class,
      'version', next_version,
      'previous_version', previous.version,
      'pricing_mode', p_pricing_mode,
      'previous_customer_price_cents', previous.customer_price_cents,
      'customer_price_cents', p_customer_price_cents,
      'previous_payout_cents', previous.reference_binder_payout_cents,
      'payout_cents', p_reference_binder_payout_cents,
      'public_visible', coalesce(p_public_visible, false),
      'change_reason', p_change_reason
    )
  );

  RETURN inserted;
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. Valider le prix d'un dossier, avec sa photographie
-- ---------------------------------------------------------------------------
-- Remplace, pour la console, `marketplace_validate_pricing`, qui reste en
-- place pour ne rien casser. Différences délibérées :
--
-- - le prix est validé une seule fois : un dossier déjà validé est refusé,
--   sa photographie ne se réécrit pas ;
-- - la marge ne bloque plus : son état est dans la photographie, et la
--   personne qui valide l'a vu dans la confirmation ;
-- - un écart au Pricebook produit un second événement, `pricing_overridden`.

CREATE OR REPLACE FUNCTION public.marketplace_validate_pricing_snapshot(
  p_case_id UUID,
  p_customer_price_cents INTEGER,
  p_customer_price_ttc_cents INTEGER,
  p_vat_rate_bps INTEGER,
  p_binder_payout_cents INTEGER,
  p_price_includes TEXT[],
  p_snapshot JSONB,
  p_overridden BOOLEAN,
  p_actor_user_id UUID
) RETURNS public.marketplace_cases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_case public.marketplace_cases;
  frozen JSONB;
BEGIN
  IF p_customer_price_cents IS NULL OR p_binder_payout_cents IS NULL
     OR p_customer_price_cents <= 0 OR p_binder_payout_cents <= 0
     OR p_binder_payout_cents > p_customer_price_cents THEN
    RAISE EXCEPTION 'Invalid managed price.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_customer_price_ttc_cents IS NULL OR p_customer_price_ttc_cents < p_customer_price_cents
     OR p_vat_rate_bps IS NULL OR p_vat_rate_bps NOT BETWEEN 0 AND 10000 THEN
    RAISE EXCEPTION 'Invalid tax breakdown.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object' THEN
    RAISE EXCEPTION 'A validated price keeps its snapshot.' USING ERRCODE = 'check_violation';
  END IF;

  frozen := p_snapshot || jsonb_build_object(
    'validatedAt', now(),
    'validatedBy', p_actor_user_id
  );

  UPDATE public.marketplace_cases
  SET customer_price_cents = p_customer_price_cents,
      customer_price_ttc_cents = p_customer_price_ttc_cents,
      pricing_vat_rate_bps = p_vat_rate_bps,
      binder_payout_cents = p_binder_payout_cents,
      price_includes = coalesce(p_price_includes, '{}'),
      pricing_snapshot = frozen,
      pricing_status = 'validated',
      pricing_validated_at = now(),
      pricing_validated_by = p_actor_user_id,
      status = 'matching'
  WHERE id = p_case_id
    AND manual_review_required = false
    AND status <> 'cancelled'
    AND pricing_status <> 'validated'
  RETURNING * INTO updated_case;

  IF updated_case.id IS NULL THEN
    RAISE EXCEPTION 'Case is unavailable, still requires manual review, or already has a validated price.'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.marketplace_events(case_id, actor_user_id, event_type, metadata)
  VALUES (
    p_case_id,
    p_actor_user_id,
    'pricing_validated',
    jsonb_build_object(
      'customer_price_cents', p_customer_price_cents,
      'customer_price_ttc_cents', p_customer_price_ttc_cents,
      'vat_rate_bps', p_vat_rate_bps,
      'binder_payout_cents', p_binder_payout_cents,
      'margin_status', p_snapshot #>> '{margin,status}',
      'overridden', coalesce(p_overridden, false)
    )
  );

  IF coalesce(p_overridden, false) THEN
    INSERT INTO public.marketplace_events(case_id, actor_user_id, event_type, metadata)
    VALUES (
      p_case_id,
      p_actor_user_id,
      'pricing_overridden',
      jsonb_build_object(
        'composed', p_snapshot -> 'composed',
        'customer_price_cents', p_customer_price_cents,
        'binder_payout_cents', p_binder_payout_cents,
        'reason', p_snapshot ->> 'overrideReason'
      )
    );
  END IF;

  RETURN updated_case;
END;
$$;

REVOKE ALL ON FUNCTION public.marketplace_publish_pricebook_entry(
  TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, TEXT, INTEGER, INTEGER,
  INTEGER, INTEGER, TEXT[], BOOLEAN, INTEGER, TEXT, TEXT, UUID
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_validate_pricing_snapshot(
  UUID, INTEGER, INTEGER, INTEGER, INTEGER, TEXT[], JSONB, BOOLEAN, UUID
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_publish_pricebook_entry(
  TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, TEXT, INTEGER, INTEGER,
  INTEGER, INTEGER, TEXT[], BOOLEAN, INTEGER, TEXT, TEXT, UUID
) TO service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_validate_pricing_snapshot(
  UUID, INTEGER, INTEGER, INTEGER, INTEGER, TEXT[], JSONB, BOOLEAN, UUID
) TO service_role;

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- À n'exécuter qu'avant la première entrée de Pricebook publiée et le premier
-- prix de dossier validé par la console : les colonnes retirées emportent les
-- prix et leurs photographies.
--
-- DROP FUNCTION IF EXISTS public.marketplace_validate_pricing_snapshot(UUID, INTEGER, INTEGER, INTEGER, INTEGER, TEXT[], JSONB, BOOLEAN, UUID);
-- DROP FUNCTION IF EXISTS public.marketplace_publish_pricebook_entry(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, TEXT[], BOOLEAN, INTEGER, TEXT, TEXT, UUID);
-- DROP INDEX IF EXISTS public.marketplace_events_type_idx;
-- ALTER TABLE public.marketplace_cases
--   DROP CONSTRAINT IF EXISTS marketplace_cases_pricing_snapshot_check,
--   DROP CONSTRAINT IF EXISTS marketplace_cases_customer_price_ttc_check,
--   DROP CONSTRAINT IF EXISTS marketplace_cases_pricing_vat_check,
--   DROP COLUMN IF EXISTS pricing_snapshot,
--   DROP COLUMN IF EXISTS customer_price_ttc_cents,
--   DROP COLUMN IF EXISTS pricing_vat_rate_bps;
-- DROP TABLE IF EXISTS public.marketplace_pricing_modifiers;
-- DROP TABLE IF EXISTS public.marketplace_price_benchmarks;
-- ALTER TABLE public.marketplace_pricebook
--   DROP CONSTRAINT IF EXISTS marketplace_pricebook_amounts_check, ... (reposer la version 20260909120000)
--   DROP COLUMN IF EXISTS pricing_mode, DROP COLUMN IF EXISTS price_ht_high_cents,
--   DROP COLUMN IF EXISTS unit_label, DROP COLUMN IF EXISTS vat_rate_bps,
--   DROP COLUMN IF EXISTS customer_price_ttc_cents, DROP COLUMN IF EXISTS minimum_margin_cents,
--   DROP COLUMN IF EXISTS included_work_items, DROP COLUMN IF EXISTS public_visible,
--   DROP COLUMN IF EXISTS change_reason, DROP COLUMN IF EXISTS created_by;
-- ALTER TABLE public.marketplace_work_items
--   DROP COLUMN IF EXISTS updated_at, DROP COLUMN IF EXISTS updated_by;
-- ALTER TABLE public.marketplace_binder_rates
--   DROP CONSTRAINT IF EXISTS marketplace_binder_rates_historical_check;
-- (reposer marketplace_binder_rates_provenance_check sans BINDER_DECLARED ni
--  HISTORICAL_TRANSACTION, après avoir requalifié les lignes concernées)
-- (marketplace_events.case_id ne peut redevenir NOT NULL qu'après suppression
--  des événements de référentiel)
