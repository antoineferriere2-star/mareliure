-- Couche commerciale immuable, séparée de la ligne mutable marketplace_cases
-- (audit du 15 septembre 2026 : "customer achète à Ma Reliure / Fine Bindery,
-- qui achète ensuite la prestation à l'atelier" — jamais une commission).
--
-- marketplace_cases reste la projection courante d'un dossier (statut,
-- suggestions, prix en cours de négociation). Cette table porte l'engagement
-- commercial : chaque ligne est une VERSION figée d'une proposition pour un
-- dossier. Avant acceptation, une nouvelle version peut en remplacer une
-- autre (superseded). Une fois `accepted_at` posé, la ligne devient immuable
-- — un trigger l'impose, pas seulement une convention côté serveur (même
-- garantie que marketplace_cases.brand, migration 20260916090000).
--
-- Additive, rejouable : chaque objet est créé sous garde, chaque contrainte
-- est supprimée avant d'être reposée.

CREATE TABLE IF NOT EXISTS public.marketplace_commercial_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.marketplace_cases(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,

  -- Fixée à la création de la proposition, jamais relue depuis le dossier
  -- après coup : la marque d'une commande ne doit jamais bouger avec elle
  -- (même règle que marketplace_cases.brand).
  brand TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  pricing_mode TEXT NOT NULL,

  -- La règle qui a produit ce chiffrage (PRICING_POLICY.version côté
  -- application) — pas un numéro de Pricebook global, qui n'existe pas
  -- encore comme source unique consultée par le moteur (voir l'audit :
  -- marketplace_pricebook sert aujourd'hui la détection de dérive, pas le
  -- chiffrage par dossier).
  pricing_rule_version TEXT NOT NULL,

  -- NULL tant qu'aucune correspondance Pricebook publiée n'existe pour ce
  -- dossier — le moteur ne l'invente jamais (voir enBookbindingCopy §59 :
  -- même discipline appliquée au prix). Quand elle existera, elle entrera
  -- dans le MAX de resolveServicePriceFloors comme un candidat de plus,
  -- jamais comme un remplacement des planchers.
  pricebook_reference_cents INTEGER,
  brand_multiplier_bps INTEGER NOT NULL CHECK (brand_multiplier_bps > 0),
  brand_reference_cents INTEGER,

  binder_payout_cents INTEGER NOT NULL CHECK (binder_payout_cents > 0),
  binder_vat_rate_bps INTEGER,
  binder_vat_amount_cents INTEGER,
  binder_payout_ttc_cents INTEGER,

  target_margin_bps INTEGER NOT NULL,
  minimum_contribution_cents INTEGER NOT NULL DEFAULT 0,
  -- Gelés au moment du calcul, pour qu'un admin (ou un test) puisse
  -- relire pourquoi ce prix précis a gagné le MAX, sans le recalculer.
  margin_floor_cents INTEGER NOT NULL,
  contribution_floor_cents INTEGER NOT NULL,
  price_bound_by TEXT NOT NULL,

  customer_service_price_cents INTEGER NOT NULL CHECK (customer_service_price_cents > 0),
  -- Uniquement renseignés en pricing_mode ESTIMATE_THEN_CONFIRM ; le prix
  -- définitif confirmé après examen devient sa propre version (§11).
  estimate_min_cents INTEGER,
  estimate_max_cents INTEGER,

  shipping_outbound_cents INTEGER NOT NULL DEFAULT 0,
  shipping_return_cents INTEGER NOT NULL DEFAULT 0,
  shipping_other_cents INTEGER NOT NULL DEFAULT 0,
  shipping_total_cents INTEGER NOT NULL DEFAULT 0,
  -- P0 : toujours 0. La colonne existe pour ne pas redemander une migration
  -- le jour où une marge ou des frais de traitement sur le transport sont
  -- décidés — rien ne les calcule encore.
  shipping_margin_cents INTEGER NOT NULL DEFAULT 0,
  shipping_handling_fee_cents INTEGER NOT NULL DEFAULT 0,

  tax_policy TEXT NOT NULL DEFAULT 'TAX_REVIEW_REQUIRED',
  customer_vat_rate_bps INTEGER,
  customer_vat_amount_cents INTEGER,
  customer_total_ht_cents INTEGER NOT NULL,
  -- NULL tant que tax_policy reste TAX_REVIEW_REQUIRED : afficher un TTC
  -- calculé sur un taux qu'on n'a pas validé serait pire que ne rien
  -- afficher.
  customer_total_ttc_cents INTEGER,

  deposit_type TEXT NOT NULL DEFAULT 'NONE',
  deposit_value_bps INTEGER,
  deposit_amount_cents INTEGER NOT NULL DEFAULT 0,
  balance_due_cents INTEGER NOT NULL,

  status TEXT NOT NULL DEFAULT 'draft',

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  superseded_at TIMESTAMPTZ
);

ALTER TABLE public.marketplace_commercial_proposals
  DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_version_positive_check,
  DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_brand_check,
  DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_pricing_mode_check,
  DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_price_bound_by_check,
  DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_tax_policy_check,
  DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_deposit_type_check,
  DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_status_check,
  DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_payout_leq_price_check,
  DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_shipping_total_check,
  DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_customer_total_ht_check,
  DROP CONSTRAINT IF EXISTS marketplace_commercial_proposals_balance_due_check;

ALTER TABLE public.marketplace_commercial_proposals
  ADD CONSTRAINT marketplace_commercial_proposals_version_positive_check
    CHECK (version > 0),
  ADD CONSTRAINT marketplace_commercial_proposals_brand_check
    CHECK (brand IN ('MA_RELIURE', 'FINE_BINDERY')),
  ADD CONSTRAINT marketplace_commercial_proposals_pricing_mode_check
    CHECK (pricing_mode IN ('FIXED_PRICE', 'ESTIMATE_THEN_CONFIRM', 'MANUAL_STUDY')),
  ADD CONSTRAINT marketplace_commercial_proposals_price_bound_by_check
    CHECK (price_bound_by IN ('reference', 'margin_floor', 'contribution_floor')),
  ADD CONSTRAINT marketplace_commercial_proposals_tax_policy_check
    CHECK (tax_policy IN ('TAX_REVIEW_REQUIRED')),
  ADD CONSTRAINT marketplace_commercial_proposals_deposit_type_check
    CHECK (deposit_type IN ('NONE', 'FIXED', 'PERCENTAGE')),
  ADD CONSTRAINT marketplace_commercial_proposals_status_check
    CHECK (status IN ('draft', 'proposed', 'accepted', 'superseded', 'cancelled')),
  ADD CONSTRAINT marketplace_commercial_proposals_payout_leq_price_check
    CHECK (binder_payout_cents <= customer_service_price_cents),
  ADD CONSTRAINT marketplace_commercial_proposals_shipping_total_check
    CHECK (shipping_total_cents = shipping_outbound_cents + shipping_return_cents + shipping_other_cents),
  ADD CONSTRAINT marketplace_commercial_proposals_customer_total_ht_check
    CHECK (customer_total_ht_cents = customer_service_price_cents + shipping_total_cents),
  ADD CONSTRAINT marketplace_commercial_proposals_balance_due_check
    CHECK (balance_due_cents >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_commercial_proposals_case_version_idx
  ON public.marketplace_commercial_proposals(case_id, version);
CREATE INDEX IF NOT EXISTS marketplace_commercial_proposals_case_idx
  ON public.marketplace_commercial_proposals(case_id, created_at);

-- Au plus une proposition acceptée par dossier — l'index partiel est la
-- garantie, pas une vérification applicative qu'un bug pourrait contourner.
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_commercial_proposals_one_accepted_idx
  ON public.marketplace_commercial_proposals(case_id) WHERE accepted_at IS NOT NULL;

GRANT ALL ON public.marketplace_commercial_proposals TO service_role;
ALTER TABLE public.marketplace_commercial_proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_commercial_proposals"
  ON public.marketplace_commercial_proposals;
CREATE POLICY "No direct access to marketplace_commercial_proposals"
  ON public.marketplace_commercial_proposals FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- Une fois acceptée, une proposition ne se modifie plus — un changement de
-- Pricebook, de coefficient de marque ou de conditions atelier survenant
-- après coup ne doit jamais silencieusement rouvrir une commande honorée.
-- Un ajustement nécessaire crée une nouvelle version (amendment), jamais une
-- écriture sur la ligne acceptée.
CREATE OR REPLACE FUNCTION public.marketplace_commercial_proposals_forbid_change_after_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'marketplace_commercial_proposals is immutable once accepted (proposal %)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_commercial_proposals_immutable_after_acceptance
  ON public.marketplace_commercial_proposals;
CREATE TRIGGER marketplace_commercial_proposals_immutable_after_acceptance
  BEFORE UPDATE ON public.marketplace_commercial_proposals
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_commercial_proposals_forbid_change_after_acceptance();

-- ---------------------------------------------------------------------------
-- Retour arrière
--
-- À n'exécuter que si aucune proposition n'a encore été acceptée : les lignes
-- acceptées emportent le seul enregistrement contractuel d'une commande.
--
-- DROP TRIGGER IF EXISTS marketplace_commercial_proposals_immutable_after_acceptance ON public.marketplace_commercial_proposals;
-- DROP FUNCTION IF EXISTS public.marketplace_commercial_proposals_forbid_change_after_acceptance();
-- DROP TABLE IF EXISTS public.marketplace_commercial_proposals;
-- ---------------------------------------------------------------------------
