-- Phase 0 / P1-2 + P1-3 — un paiement n'est « payé » qu'une fois vérifié, et un événement Stripe
-- n'est « traité » qu'une fois réellement traité.
--
-- Défaut corrigé (P1-3) : le webhook insérait l'événement, puis, sur une erreur métier, écrivait
-- `processing_error` et répondait 200. L'événement restait en base : toute redélivrance de Stripe
-- était alors absorbée comme « doublon déjà traité » — un paiement encaissé pouvait ne JAMAIS être
-- enregistré. Ici l'état de l'événement est explicite :
--
--   received ─▶ processing ─▶ processed          (terminal : les doublons sont accusés, jamais rejoués)
--                    └──────▶ failed ─▶ processing (reprise idempotente à la redélivrance)
--
-- `processing` qui dure plus de `p_stale_after_seconds` (worker mort en cours de route) est repris.
-- Pas d'infrastructure distribuée : une ligne, un verrou de ligne, un compteur.
--
-- P1-2 : la ligne de paiement garde ce qui a été réellement encaissé (montant, devise) pour la
-- traçabilité, et `marketplace_mark_proposal_paid` n'écrase jamais un paiement déjà enregistré.
--
-- Additive et rejouable : colonnes et fonctions seulement, aucune donnée supprimée.

ALTER TABLE public.marketplace_stripe_webhook_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

ALTER TABLE public.marketplace_stripe_webhook_events
  DROP CONSTRAINT IF EXISTS marketplace_stripe_webhook_events_status_check;
ALTER TABLE public.marketplace_stripe_webhook_events
  ADD CONSTRAINT marketplace_stripe_webhook_events_status_check
  CHECK (status IN ('received', 'processing', 'processed', 'failed'));

-- Stratégie de reprise des événements existants (avant cette migration) :
--   traité (processed_at)            → processed  : jamais rejoué ;
--   en erreur (processing_error)     → failed     : rejoué si Stripe le redélivre (renvoi depuis le Dashboard) ;
--   ni l'un ni l'autre (arrêt brutal) → reste received : repris à la prochaine redélivrance.
-- Ne touche que les lignes encore à l'état par défaut : rejouable sans effet.
UPDATE public.marketplace_stripe_webhook_events
SET status = CASE WHEN processed_at IS NOT NULL THEN 'processed' ELSE 'failed' END,
    attempts = 1
WHERE status = 'received'
  AND attempts = 0
  AND (processed_at IS NOT NULL OR processing_error IS NOT NULL);

CREATE INDEX IF NOT EXISTS marketplace_stripe_webhook_events_status_idx
  ON public.marketplace_stripe_webhook_events (status)
  WHERE status <> 'processed';

ALTER TABLE public.marketplace_commercial_proposal_payments
  ADD COLUMN IF NOT EXISTS amount_paid_cents INTEGER,
  ADD COLUMN IF NOT EXISTS paid_currency TEXT;

-- Réclame un événement pour traitement, de façon atomique.
--   claimed            : à traiter (première fois, ou reprise d'un événement failed / received / bloqué) ;
--   already_processed  : doublon d'un événement terminé — accusé de réception, jamais rejoué ;
--   in_progress        : un autre worker le traite en ce moment — Stripe réessaiera plus tard.
CREATE OR REPLACE FUNCTION public.marketplace_claim_webhook_event(
  p_id TEXT,
  p_type TEXT,
  p_payload JSONB,
  p_stale_after_seconds INTEGER DEFAULT 300
) RETURNS TABLE (claim_outcome TEXT, claim_attempts INTEGER)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v public.marketplace_stripe_webhook_events%ROWTYPE;
BEGIN
  INSERT INTO public.marketplace_stripe_webhook_events
    (id, type, payload, status, attempts, processing_started_at, last_attempt_at)
  VALUES (p_id, p_type, p_payload, 'processing', 1, now(), now())
  ON CONFLICT (id) DO NOTHING;
  IF FOUND THEN
    RETURN QUERY SELECT 'claimed'::TEXT, 1;
    RETURN;
  END IF;

  SELECT * INTO v FROM public.marketplace_stripe_webhook_events WHERE id = p_id FOR UPDATE;

  IF v.status = 'processed' THEN
    RETURN QUERY SELECT 'already_processed'::TEXT, v.attempts;
    RETURN;
  END IF;
  IF v.status = 'processing'
     AND v.processing_started_at IS NOT NULL
     AND v.processing_started_at > now() - make_interval(secs => p_stale_after_seconds) THEN
    RETURN QUERY SELECT 'in_progress'::TEXT, v.attempts;
    RETURN;
  END IF;

  UPDATE public.marketplace_stripe_webhook_events
  SET status = 'processing',
      attempts = attempts + 1,
      processing_started_at = now(),
      last_attempt_at = now()
  WHERE id = p_id;
  RETURN QUERY SELECT 'claimed'::TEXT, v.attempts + 1;
END;
$$;

-- Enregistre un paiement UNE fois. Ne réécrit jamais un paiement déjà enregistré :
--   marked        : premier enregistrement ;
--   already_paid_same : rejeu du même PaymentIntent (doublon d'événement, reprise) — sans effet ;
--   other_payment : la proposition est déjà payée par un AUTRE PaymentIntent (double paiement) —
--                   l'appelant le signale, rien n'est écrasé.
CREATE OR REPLACE FUNCTION public.marketplace_mark_proposal_paid(
  p_proposal_id UUID,
  p_payment_intent_id TEXT,
  p_invoice_id TEXT,
  p_amount_cents INTEGER,
  p_currency TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v public.marketplace_commercial_proposal_payments%ROWTYPE;
BEGIN
  INSERT INTO public.marketplace_commercial_proposal_payments AS p
    (proposal_id, stripe_payment_intent_id, stripe_invoice_id, paid_at, amount_paid_cents, paid_currency, updated_at)
  VALUES
    (p_proposal_id, p_payment_intent_id, p_invoice_id, now(), p_amount_cents, lower(p_currency), now())
  ON CONFLICT (proposal_id) DO UPDATE
    SET stripe_payment_intent_id = EXCLUDED.stripe_payment_intent_id,
        stripe_invoice_id = EXCLUDED.stripe_invoice_id,
        paid_at = EXCLUDED.paid_at,
        amount_paid_cents = EXCLUDED.amount_paid_cents,
        paid_currency = EXCLUDED.paid_currency,
        updated_at = EXCLUDED.updated_at
    WHERE p.paid_at IS NULL;
  IF FOUND THEN RETURN 'marked'; END IF;

  SELECT * INTO v FROM public.marketplace_commercial_proposal_payments WHERE proposal_id = p_proposal_id;
  IF v.stripe_payment_intent_id = p_payment_intent_id THEN RETURN 'already_paid_same'; END IF;
  RETURN 'other_payment';
END;
$$;

-- Jamais appelables depuis un navigateur.
REVOKE ALL ON FUNCTION public.marketplace_claim_webhook_event(TEXT, TEXT, JSONB, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketplace_mark_proposal_paid(UUID, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_claim_webhook_event(TEXT, TEXT, JSONB, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_mark_proposal_paid(UUID, TEXT, TEXT, INTEGER, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- Retour arrière (colonnes conservées si des événements y sont déjà enregistrés)
--
-- DROP FUNCTION IF EXISTS public.marketplace_mark_proposal_paid(UUID, TEXT, TEXT, INTEGER, TEXT);
-- DROP FUNCTION IF EXISTS public.marketplace_claim_webhook_event(TEXT, TEXT, JSONB, INTEGER);
-- DROP INDEX IF EXISTS public.marketplace_stripe_webhook_events_status_idx;
-- ALTER TABLE public.marketplace_stripe_webhook_events DROP CONSTRAINT IF EXISTS marketplace_stripe_webhook_events_status_check;
-- (les colonnes status / attempts / processing_started_at / last_attempt_at, amount_paid_cents / paid_currency sont inoffensives)
