-- First circuit: declared external settlement, no Stripe movement and no platform fee.
ALTER TABLE public.marketplace_binder_invoices DROP CONSTRAINT marketplace_binder_invoices_payment_status_check;
ALTER TABLE public.marketplace_binder_invoices ADD CONSTRAINT marketplace_binder_invoices_payment_status_check
CHECK(payment_status IN ('unpaid','deposit_paid','partial','paid'));
CREATE TABLE public.marketplace_own_client_agreements (
  quote_id uuid PRIMARY KEY REFERENCES public.marketplace_binder_quotes(id) ON DELETE RESTRICT,
  binder_id uuid NOT NULL REFERENCES public.marketplace_binders(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  evidence text NOT NULL CHECK(length(btrim(evidence)) BETWEEN 8 AND 500),
  terms jsonb NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.marketplace_external_settlements (
  id uuid PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.marketplace_binder_invoices(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  kind text NOT NULL CHECK(kind IN ('receipt','refund','dispute_open','dispute_close')),
  amount_cents integer NOT NULL CHECK(amount_cents>=0),
  currency text NOT NULL,
  evidence text NOT NULL CHECK(length(btrim(evidence)) BETWEEN 8 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind IN ('receipt','refund') AND amount_cents>0) OR (kind IN ('dispute_open','dispute_close') AND amount_cents=0))
);
CREATE INDEX marketplace_external_settlements_invoice_idx ON public.marketplace_external_settlements(invoice_id,created_at);
CREATE UNIQUE INDEX marketplace_external_settlements_proof_once ON public.marketplace_external_settlements(invoice_id,kind,evidence)
WHERE kind IN ('receipt','refund');
ALTER TABLE public.marketplace_own_client_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_external_settlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketplace_own_client_agreements,public.marketplace_external_settlements FROM anon,authenticated;
GRANT SELECT,INSERT ON public.marketplace_own_client_agreements,public.marketplace_external_settlements TO service_role;
CREATE FUNCTION public.marketplace_settlement_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  RAISE EXCEPTION 'settlement_history_immutable';
END $$;
CREATE TRIGGER settlement_immutable BEFORE UPDATE OR DELETE ON public.marketplace_external_settlements
FOR EACH ROW EXECUTE FUNCTION public.marketplace_settlement_immutable();
CREATE TRIGGER agreement_immutable BEFORE UPDATE OR DELETE ON public.marketplace_own_client_agreements
FOR EACH ROW EXECUTE FUNCTION public.marketplace_settlement_immutable();

CREATE FUNCTION public.marketplace_external_member(p_binder uuid,p_actor uuid) RETURNS void
LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM marketplace_binder_members WHERE binder_id=p_binder AND user_id=p_actor AND account_status='active') THEN
    RAISE EXCEPTION 'active_membership_required';
  END IF;
END $$;

CREATE FUNCTION public.marketplace_own_quote_eligible(p_quote uuid,p_binder uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM marketplace_binder_quotes q
    LEFT JOIN marketplace_binder_works w ON w.id=q.work_id AND w.binder_id=q.binder_id
    LEFT JOIN marketplace_binder_clients c ON c.id=q.client_id AND c.binder_id=q.binder_id
    WHERE q.id=p_quote AND q.binder_id=p_binder AND q.deposit_cents=0
    AND ((q.work_id IS NOT NULL AND w.source='mon_client' AND w.case_id IS NULL)
      OR (q.work_id IS NULL AND c.origin='mon_client' AND c.origin_case_id IS NULL)))
$$;

CREATE FUNCTION public.marketplace_own_contract(p_quote uuid,p_binder uuid,p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE q marketplace_binder_quotes%ROWTYPE;
BEGIN
  PERFORM marketplace_external_member(p_binder,p_actor);
  SELECT * INTO q FROM marketplace_binder_quotes WHERE id=p_quote AND binder_id=p_binder;
  IF NOT FOUND THEN RAISE EXCEPTION 'quote_not_found'; END IF;
  RETURN jsonb_build_object('eligible',marketplace_own_quote_eligible(p_quote,p_binder),'version','own-external-v1',
    'seller',q.issuer,'currency',q.currency,'totalCents',q.total_ttc_cents,'feeCents',0,
    'evidence',(SELECT evidence FROM marketplace_own_client_agreements WHERE quote_id=q.id));
END $$;

CREATE FUNCTION public.marketplace_accept_own_quote(p_quote uuid,p_binder uuid,p_actor uuid,p_evidence text) RETURNS void
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE q marketplace_binder_quotes%ROWTYPE; a marketplace_own_client_agreements%ROWTYPE;
BEGIN
  PERFORM marketplace_external_member(p_binder,p_actor);
  SELECT * INTO q FROM marketplace_binder_quotes WHERE id=p_quote AND binder_id=p_binder FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'quote_not_found'; END IF;
  SELECT * INTO a FROM marketplace_own_client_agreements WHERE quote_id=p_quote;
  IF FOUND THEN
    IF a.evidence IS DISTINCT FROM btrim(p_evidence) THEN RAISE EXCEPTION 'agreement_already_recorded'; END IF;
    RETURN;
  END IF;
  IF q.status<>'sent' OR NOT marketplace_own_quote_eligible(p_quote,p_binder) THEN RAISE EXCEPTION 'external_contract_unavailable'; END IF;
  INSERT INTO marketplace_own_client_agreements(quote_id,binder_id,actor_id,evidence,terms)
  VALUES(q.id,p_binder,p_actor,btrim(p_evidence),jsonb_build_object('version','own-external-v1','seller',q.issuer,
    'currency',q.currency,'total_ttc_cents',q.total_ttc_cents,'collection','external','platform_fee_cents',0));
  UPDATE marketplace_binder_quotes SET status='accepted' WHERE id=q.id;
END $$;

CREATE FUNCTION public.marketplace_require_own_agreement() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE a marketplace_own_client_agreements%ROWTYPE;
BEGIN
  IF NEW.status='accepted' AND (TG_OP='INSERT' OR OLD.status NOT IN ('accepted','invoiced'))
    AND NEW.payment_snapshot->>'circuit'='own_client' THEN
    SELECT * INTO a FROM marketplace_own_client_agreements WHERE quote_id=NEW.id AND binder_id=NEW.binder_id;
    IF NOT FOUND OR a.terms->>'currency' IS DISTINCT FROM NEW.currency
      OR (a.terms->>'total_ttc_cents')::bigint IS DISTINCT FROM NEW.total_ttc_cents THEN RAISE EXCEPTION 'own_agreement_required'; END IF;
    NEW.payment_snapshot := NEW.payment_snapshot || jsonb_build_object('agreement_version','own-external-v1',
      'platform_fee_cents',0,'agreement_recorded_at',a.accepted_at,'acceptance_evidence',a.evidence);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER z_marketplace_require_own_agreement BEFORE INSERT OR UPDATE ON public.marketplace_binder_quotes
FOR EACH ROW EXECUTE FUNCTION public.marketplace_require_own_agreement();

-- A paid status for this circuit must be a projection of its evidence journal.
CREATE FUNCTION public.marketplace_external_balance_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE net bigint;
BEGIN
  IF NEW.payment_snapshot->>'agreement_version'='own-external-v1' THEN
    SELECT coalesce(sum(CASE WHEN kind='receipt' THEN amount_cents WHEN kind='refund' THEN -amount_cents ELSE 0 END),0)
      INTO net FROM marketplace_external_settlements WHERE invoice_id=NEW.id;
    IF NEW.amount_paid_cents IS DISTINCT FROM net OR NEW.deposit_paid_cents<>0
      OR NEW.payment_status IS DISTINCT FROM (CASE WHEN net=0 THEN 'unpaid' WHEN net=NEW.total_ttc_cents THEN 'paid' ELSE 'partial' END)
      OR (NEW.paid_at IS NOT NULL) IS DISTINCT FROM (net>0 AND net=NEW.total_ttc_cents) THEN
      RAISE EXCEPTION 'payment_evidence_required';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER zz_marketplace_external_balance_guard BEFORE INSERT OR UPDATE ON public.marketplace_binder_invoices
FOR EACH ROW EXECUTE FUNCTION public.marketplace_external_balance_guard();

CREATE FUNCTION public.marketplace_external_settlement_state(p_invoice uuid,p_binder uuid,p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE i marketplace_binder_invoices%ROWTYPE; events jsonb; net bigint; disputed boolean;
BEGIN
  PERFORM marketplace_external_member(p_binder,p_actor);
  SELECT * INTO i FROM marketplace_binder_invoices WHERE id=p_invoice AND binder_id=p_binder;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_not_found'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.created_at,e.id),'[]'::jsonb),
    coalesce(sum(CASE WHEN kind='receipt' THEN amount_cents WHEN kind='refund' THEN -amount_cents ELSE 0 END),0)
    INTO events,net FROM marketplace_external_settlements e WHERE invoice_id=p_invoice;
  SELECT kind='dispute_open' INTO disputed FROM marketplace_external_settlements WHERE invoice_id=p_invoice AND kind IN ('dispute_open','dispute_close') ORDER BY created_at DESC,id DESC LIMIT 1;
  RETURN jsonb_build_object('eligible',i.payment_snapshot->>'agreement_version'='own-external-v1' AND i.status IN ('issued','credited'),
    'currency',i.currency,'totalCents',i.total_ttc_cents,'netCents',net,'disputed',coalesce(disputed,false),'events',events);
END $$;

CREATE FUNCTION public.marketplace_record_external_settlement(p_id uuid,p_invoice uuid,p_binder uuid,p_actor uuid,p_kind text,p_amount integer,p_evidence text) RETURNS void
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE i marketplace_binder_invoices%ROWTYPE; e marketplace_external_settlements%ROWTYPE; net bigint; disputed boolean;
BEGIN
  PERFORM marketplace_external_member(p_binder,p_actor);
  SELECT * INTO i FROM marketplace_binder_invoices WHERE id=p_invoice AND binder_id=p_binder FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice_not_found'; END IF;
  SELECT * INTO e FROM marketplace_external_settlements WHERE id=p_id;
  IF FOUND THEN
    IF e.invoice_id IS DISTINCT FROM p_invoice OR e.kind IS DISTINCT FROM p_kind OR e.amount_cents IS DISTINCT FROM p_amount
      OR e.evidence IS DISTINCT FROM btrim(p_evidence) OR e.actor_id IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN;
  END IF;
  IF i.payment_snapshot->>'agreement_version' IS DISTINCT FROM 'own-external-v1' OR i.status NOT IN ('issued','credited') THEN
    RAISE EXCEPTION 'external_settlement_locked';
  END IF;
  SELECT coalesce(sum(CASE WHEN kind='receipt' THEN amount_cents WHEN kind='refund' THEN -amount_cents ELSE 0 END),0)
    INTO net FROM marketplace_external_settlements WHERE invoice_id=p_invoice;
  SELECT kind='dispute_open' INTO disputed FROM marketplace_external_settlements WHERE invoice_id=p_invoice AND kind IN ('dispute_open','dispute_close') ORDER BY created_at DESC,id DESC LIMIT 1;
  IF p_kind='receipt' AND (i.status<>'issued' OR coalesce(disputed,false) OR p_amount>i.total_ttc_cents-net
    OR EXISTS(SELECT 1 FROM marketplace_binder_credit_notes WHERE invoice_id=p_invoice)) THEN RAISE EXCEPTION 'receipt_not_due'; END IF;
  IF p_kind='refund' AND p_amount>net THEN RAISE EXCEPTION 'refund_exceeds_receipts'; END IF;
  IF (p_kind='dispute_open' AND coalesce(disputed,false)) OR (p_kind='dispute_close' AND NOT coalesce(disputed,false)) THEN RAISE EXCEPTION 'dispute_transition_invalid'; END IF;
  INSERT INTO marketplace_external_settlements VALUES(p_id,p_invoice,p_actor,p_kind,p_amount,i.currency,btrim(p_evidence),clock_timestamp());
  IF p_kind IN ('receipt','refund') THEN
    net := net + CASE WHEN p_kind='receipt' THEN p_amount ELSE -p_amount END;
    UPDATE marketplace_binder_invoices SET amount_paid_cents=net,
      payment_status=CASE WHEN net=0 THEN 'unpaid' WHEN net=total_ttc_cents THEN 'paid' ELSE 'partial' END,
      paid_at=CASE WHEN net=total_ttc_cents THEN now() ELSE NULL END WHERE id=p_invoice;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.marketplace_external_member(uuid,uuid),public.marketplace_own_quote_eligible(uuid,uuid),
 public.marketplace_own_contract(uuid,uuid,uuid),public.marketplace_accept_own_quote(uuid,uuid,uuid,text),
 public.marketplace_external_settlement_state(uuid,uuid,uuid),public.marketplace_record_external_settlement(uuid,uuid,uuid,uuid,text,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_external_member(uuid,uuid),public.marketplace_own_quote_eligible(uuid,uuid),
 public.marketplace_own_contract(uuid,uuid,uuid),public.marketplace_accept_own_quote(uuid,uuid,uuid,text),
 public.marketplace_external_settlement_state(uuid,uuid,uuid),public.marketplace_record_external_settlement(uuid,uuid,uuid,uuid,text,integer,text) TO service_role;
