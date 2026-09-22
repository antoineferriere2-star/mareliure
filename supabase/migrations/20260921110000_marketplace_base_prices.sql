-- Ma Reliure — Tarif de base interne.
--
-- Cette table est volontairement distincte des observations atelier et du
-- Pricebook historique. Elle porte une convention de départ administrable,
-- jamais un tarif imposé à un atelier ni un prix figé dans un devis.

CREATE TABLE IF NOT EXISTS public.marketplace_reference_default_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_key TEXT NOT NULL REFERENCES public.marketplace_work_items(key),
  reference_version TEXT NOT NULL,
  default_unit_price_cents INTEGER,
  unit TEXT NOT NULL,
  pricing_mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  source_note TEXT,
  confidence TEXT NOT NULL DEFAULT 'low',
  needs_human_validation BOOLEAN NOT NULL DEFAULT true,
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_reference_default_prices
  DROP CONSTRAINT IF EXISTS marketplace_reference_default_prices_mode_check,
  DROP CONSTRAINT IF EXISTS marketplace_reference_default_prices_status_check,
  DROP CONSTRAINT IF EXISTS marketplace_reference_default_prices_confidence_check,
  DROP CONSTRAINT IF EXISTS marketplace_reference_default_prices_version_check,
  DROP CONSTRAINT IF EXISTS marketplace_reference_default_prices_price_check,
  DROP CONSTRAINT IF EXISTS marketplace_reference_default_prices_published_check;

ALTER TABLE public.marketplace_reference_default_prices
  ADD CONSTRAINT marketplace_reference_default_prices_mode_check CHECK (pricing_mode IN (
    'fixed', 'unit', 'starting_from', 'manual_review'
  )),
  ADD CONSTRAINT marketplace_reference_default_prices_status_check CHECK (status IN (
    'draft', 'published', 'retired'
  )),
  ADD CONSTRAINT marketplace_reference_default_prices_confidence_check CHECK (confidence IN (
    'low', 'medium', 'high'
  )),
  ADD CONSTRAINT marketplace_reference_default_prices_version_check CHECK (version >= 1),
  -- Zéro est un prix explicite. Seul manual_review porte un montant NULL.
  ADD CONSTRAINT marketplace_reference_default_prices_price_check CHECK (
    (pricing_mode = 'manual_review' AND default_unit_price_cents IS NULL)
    OR (pricing_mode <> 'manual_review' AND default_unit_price_cents IS NOT NULL
      AND default_unit_price_cents >= 0)
  ),
  ADD CONSTRAINT marketplace_reference_default_prices_published_check CHECK (
    status <> 'published'
    OR (validated_at IS NOT NULL AND validated_by IS NOT NULL AND published_at IS NOT NULL)
  );

-- Plusieurs versions coexistent pour l'historique, une seule peut être en
-- vigueur pour une prestation et une version de référentiel.
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_reference_default_prices_version_unique
  ON public.marketplace_reference_default_prices(pricing_key, reference_version, version);
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_reference_default_prices_current_unique
  ON public.marketplace_reference_default_prices(pricing_key, reference_version)
  WHERE status IN ('draft', 'published');
CREATE INDEX IF NOT EXISTS marketplace_reference_default_prices_lookup_idx
  ON public.marketplace_reference_default_prices(reference_version, pricing_key)
  WHERE status <> 'retired';

ALTER TABLE public.marketplace_reference_default_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_reference_default_prices"
  ON public.marketplace_reference_default_prices;
CREATE POLICY "No direct access to marketplace_reference_default_prices"
  ON public.marketplace_reference_default_prices FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- Le mapping est séparé du prix : il peut être exact, composite ou n'être
-- qu'un repère déclaré comme tel. Aucune ligne de cette table n'est semée en
-- A1 ; PR A2 chargera le mapping et les valeurs validées ensemble.
CREATE TABLE IF NOT EXISTS public.marketplace_reference_price_operation_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_key TEXT NOT NULL REFERENCES public.marketplace_work_items(key),
  reference_version TEXT NOT NULL,
  reference_operation_key TEXT,
  mapping_type TEXT NOT NULL,
  mapping_note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_reference_price_operation_links
  DROP CONSTRAINT IF EXISTS marketplace_reference_price_operation_links_type_check;
ALTER TABLE public.marketplace_reference_price_operation_links
  ADD CONSTRAINT marketplace_reference_price_operation_links_type_check CHECK (mapping_type IN (
    'exact', 'composite', 'no_direct_match'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_reference_price_operation_links_unique
  ON public.marketplace_reference_price_operation_links(
    pricing_key, reference_version, reference_operation_key, mapping_type
  ) NULLS NOT DISTINCT;

ALTER TABLE public.marketplace_reference_price_operation_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_reference_price_operation_links"
  ON public.marketplace_reference_price_operation_links;
CREATE POLICY "No direct access to marketplace_reference_price_operation_links"
  ON public.marketplace_reference_price_operation_links FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- Rollback
-- DROP TABLE IF EXISTS public.marketplace_reference_price_operation_links;
-- DROP TABLE IF EXISTS public.marketplace_reference_default_prices;
