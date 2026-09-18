-- Chantier Stripe live (16 septembre 2026, brief post-Phase 1). Trois
-- ajouts, tous additifs : ce que Checkout doit pouvoir retrouver côté
-- proposition, ce qu'un futur Connected Account d'atelier doit pouvoir
-- retrouver côté binder, et la table d'idempotence des webhooks — un
-- retry réseau ou une redélivrance Stripe ne doit jamais rejouer deux fois
-- le même événement financier (§17 du brief).

-- Une proposition acceptée est la seule source de vérité pour un montant à
-- facturer (§10) — et reste rigoureusement immuable (trigger de la
-- migration 20260916100000, "Do not touch" du handoff). L'état d'un
-- paiement n'est PAS un terme commercial : c'est une métadonnée
-- opérationnelle qui évolue après l'acceptation (Checkout créé, payé,
-- échoué…). Plutôt que de percer une exception dans le trigger
-- d'immuabilité, cet état vit dans une table séparée, une ligne par
-- proposition, explicitement mutable.
CREATE TABLE IF NOT EXISTS public.marketplace_commercial_proposal_payments (
  proposal_id UUID PRIMARY KEY REFERENCES public.marketplace_commercial_proposals(id) ON DELETE CASCADE,
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_commercial_proposal_payments_checkout_session_idx
  ON public.marketplace_commercial_proposal_payments(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

GRANT ALL ON public.marketplace_commercial_proposal_payments TO service_role;
ALTER TABLE public.marketplace_commercial_proposal_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_commercial_proposal_payments"
  ON public.marketplace_commercial_proposal_payments;
CREATE POLICY "No direct access to marketplace_commercial_proposal_payments"
  ON public.marketplace_commercial_proposal_payments FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- Préparé pour Connect (§18-19) : `stripe_account_id` existe déjà sur cette
-- table depuis la toute première migration marketplace (20260908120000,
-- "Stripe Connect lands in P1; the column exists so the P1 migration is a
-- backfill rather than a schema change on a live table") — on le réutilise
-- au lieu d'en dupliquer un second. Aucune ligne n'est renseignée tant
-- qu'un atelier réel n'a pas fait son onboarding — voir "Do not touch" du
-- handoff, aucun Connected Account de test n'est créé par ce chantier.
ALTER TABLE public.marketplace_binders
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_binders_stripe_account_id_idx
  ON public.marketplace_binders(stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

-- La clé d'idempotence du webhook lui-même : l'identifiant d'événement
-- Stripe (`evt_...`), garanti stable par Stripe à travers ses propres
-- redélivrances. `PRIMARY KEY` est la garantie, pas une convention
-- applicative qu'un bug pourrait contourner.
CREATE TABLE IF NOT EXISTS public.marketplace_stripe_webhook_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  payload JSONB NOT NULL
);

GRANT ALL ON public.marketplace_stripe_webhook_events TO service_role;
ALTER TABLE public.marketplace_stripe_webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to marketplace_stripe_webhook_events"
  ON public.marketplace_stripe_webhook_events;
CREATE POLICY "No direct access to marketplace_stripe_webhook_events"
  ON public.marketplace_stripe_webhook_events FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Retour arrière
--
-- DROP TABLE IF EXISTS public.marketplace_stripe_webhook_events;
-- ALTER TABLE public.marketplace_binders
--   DROP CONSTRAINT IF EXISTS marketplace_binders_stripe_account_id_idx,
--   DROP COLUMN IF EXISTS stripe_connect_payouts_enabled,
--   DROP COLUMN IF EXISTS stripe_connect_charges_enabled,
--   DROP COLUMN IF EXISTS stripe_connect_onboarded_at;
-- DROP TABLE IF EXISTS public.marketplace_commercial_proposal_payments;
-- ---------------------------------------------------------------------------
