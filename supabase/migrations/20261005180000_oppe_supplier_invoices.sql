-- Activité A — facture de l'atelier à Oppe et règlement de l'atelier (modèle du 5 octobre 2026).
--
-- L'atelier facture Oppe (jamais le client final) la rémunération qu'il a acceptée, une fois le
-- travail terminé : depuis l'outil (PDF généré, mentions de l'atelier) ou déposée comme facture
-- externe (PDF). Le montant HT est celui de l'accord, sans supplément. Oppe contrôle la facture,
-- puis la règle par virement manuel, 30 jours à compter de l'émission d'une facture conforme ;
-- chaque règlement porte une référence unique et se rapproche du solde. La TVA d'achat est
-- enregistrée séparément de la TVA de vente.
--
-- Aucune donnée existante n'est modifiée.

CREATE TABLE public.marketplace_oppe_supplier_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.marketplace_cases(id) ON DELETE RESTRICT,
  assignment_id uuid NOT NULL REFERENCES public.marketplace_oppe_order_assignments(id) ON DELETE RESTRICT,
  binder_id uuid NOT NULL REFERENCES public.marketplace_binders(id) ON DELETE RESTRICT,
  source text NOT NULL CHECK (source IN ('tool', 'external')),
  invoice_number text NOT NULL CHECK (length(btrim(invoice_number)) BETWEEN 1 AND 60),
  issue_date date NOT NULL,
  due_date date NOT NULL,
  amount_ht_cents integer NOT NULL CHECK (amount_ht_cents > 0),
  vat_regime text NOT NULL CHECK (vat_regime IN ('FRANCHISE', 'VAT_LIABLE')),
  vat_rate_bps integer CHECK (vat_rate_bps IS NULL OR vat_rate_bps BETWEEN 0 AND 3000),
  vat_cents integer NOT NULL CHECK (vat_cents >= 0),
  amount_ttc_cents integer NOT NULL,
  vat_mention text,
  document_path text NOT NULL,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'accepted', 'rejected', 'paid')),
  review_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  submitted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (amount_ttc_cents = amount_ht_cents + vat_cents),
  CHECK (vat_regime <> 'FRANCHISE' OR (vat_cents = 0 AND length(btrim(coalesce(vat_mention, ''))) > 0)),
  CHECK (vat_regime <> 'VAT_LIABLE' OR vat_rate_bps IS NOT NULL),
  CHECK (status <> 'rejected' OR length(btrim(coalesce(review_reason, ''))) >= 5),
  CHECK (due_date >= issue_date)
);
-- Un seul numéro par atelier (doublons refusés, casse et espaces ignorés), sauf facture rejetée.
CREATE UNIQUE INDEX marketplace_oppe_supplier_invoices_number_uniq
  ON public.marketplace_oppe_supplier_invoices (binder_id, lower(btrim(invoice_number))) WHERE status <> 'rejected';
-- Une seule facture vivante par affectation.
CREATE UNIQUE INDEX marketplace_oppe_supplier_invoices_one_live
  ON public.marketplace_oppe_supplier_invoices (assignment_id) WHERE status <> 'rejected';

CREATE TABLE public.marketplace_oppe_supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.marketplace_oppe_supplier_invoices(id) ON DELETE RESTRICT,
  paid_on date NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  reference text NOT NULL CHECK (length(btrim(reference)) BETWEEN 3 AND 120),
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX marketplace_oppe_supplier_payments_reference_uniq
  ON public.marketplace_oppe_supplier_payments (lower(btrim(reference)));

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['marketplace_oppe_supplier_invoices', 'marketplace_oppe_supplier_payments'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- Les paiements enregistrés ne se modifient ni ne se suppriment : une erreur se corrige par une écriture inverse
-- décidée par l'administration, jamais par réécriture.
CREATE FUNCTION public.marketplace_forbid_supplier_payment_change() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'supplier_payment_immutable'; END $$;
CREATE TRIGGER marketplace_oppe_supplier_payments_immutable BEFORE UPDATE OR DELETE ON public.marketplace_oppe_supplier_payments
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_forbid_supplier_payment_change();

-- Les termes d'une facture déposée ne se réécrivent pas : seuls statut et revue évoluent.
CREATE FUNCTION public.marketplace_freeze_supplier_invoice_terms() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.amount_ht_cents IS DISTINCT FROM OLD.amount_ht_cents OR NEW.vat_cents IS DISTINCT FROM OLD.vat_cents
     OR NEW.amount_ttc_cents IS DISTINCT FROM OLD.amount_ttc_cents OR NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
     OR NEW.issue_date IS DISTINCT FROM OLD.issue_date OR NEW.due_date IS DISTINCT FROM OLD.due_date
     OR NEW.binder_id IS DISTINCT FROM OLD.binder_id OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
     OR NEW.document_path IS DISTINCT FROM OLD.document_path OR NEW.vat_regime IS DISTINCT FROM OLD.vat_regime THEN
    RAISE EXCEPTION 'supplier_invoice_terms_immutable' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER marketplace_freeze_supplier_invoice_terms BEFORE UPDATE ON public.marketplace_oppe_supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_freeze_supplier_invoice_terms();

-- Dépôt par l'atelier de l'affectation active, commande terminée, montant HT = rémunération acceptée.
CREATE FUNCTION public.marketplace_submit_supplier_invoice(
  p_case uuid, p_binder uuid, p_source text, p_number text, p_issue_date date, p_vat_regime text,
  p_vat_rate_bps integer, p_vat_mention text, p_document_path text, p_actor uuid
) RETURNS uuid
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a public.marketplace_oppe_order_assignments%ROWTYPE; o public.marketplace_oppe_orders%ROWTYPE; v_vat integer; v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.marketplace_binder_members m WHERE m.binder_id = p_binder AND m.user_id = p_actor AND m.account_status = 'active') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO o FROM public.marketplace_oppe_orders WHERE case_id = p_case FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  SELECT * INTO a FROM public.marketplace_oppe_order_assignments WHERE case_id = p_case AND ended_at IS NULL FOR UPDATE;
  IF NOT FOUND OR a.binder_id <> p_binder THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF o.status <> 'completed' THEN RAISE EXCEPTION 'supplier_invoice_requires_completed_order'; END IF;
  IF p_issue_date IS NULL OR p_issue_date > (now() AT TIME ZONE 'Europe/Paris')::date THEN RAISE EXCEPTION 'supplier_invoice_date_invalid'; END IF;
  v_vat := CASE WHEN p_vat_regime = 'FRANCHISE' THEN 0 ELSE round(a.payout_cents::numeric * coalesce(p_vat_rate_bps, 0) / 10000)::integer END;
  INSERT INTO public.marketplace_oppe_supplier_invoices(case_id, assignment_id, binder_id, source, invoice_number, issue_date, due_date,
    amount_ht_cents, vat_regime, vat_rate_bps, vat_cents, amount_ttc_cents, vat_mention, document_path, submitted_by)
  VALUES (p_case, a.id, p_binder, p_source, btrim(p_number), p_issue_date, p_issue_date + 30,
    a.payout_cents, p_vat_regime, CASE WHEN p_vat_regime = 'FRANCHISE' THEN NULL ELSE p_vat_rate_bps END, v_vat, a.payout_cents + v_vat,
    nullif(btrim(coalesce(p_vat_mention, '')), ''), p_document_path, p_actor)
  RETURNING id INTO v_id;
  INSERT INTO public.marketplace_events(case_id, binder_id, actor_user_id, event_type, metadata)
  VALUES (p_case, p_binder, p_actor, 'supplier_invoice_submitted',
          jsonb_build_object('invoice_id', v_id, 'number', btrim(p_number), 'amount_ht_cents', a.payout_cents, 'source', p_source));
  RETURN v_id;
END $$;

CREATE FUNCTION public.marketplace_review_supplier_invoice(p_invoice uuid, p_decision text, p_reason text, p_actor uuid)
RETURNS text
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE i public.marketplace_oppe_supplier_invoices%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_actor AND role = 'admin') THEN RAISE EXCEPTION 'admin_required'; END IF;
  IF p_decision NOT IN ('accepted', 'rejected') THEN RAISE EXCEPTION 'supplier_review_decision_invalid'; END IF;
  SELECT * INTO i FROM public.marketplace_oppe_supplier_invoices WHERE id = p_invoice FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'supplier_invoice_not_found'; END IF;
  IF i.status <> 'submitted' THEN RAISE EXCEPTION 'supplier_invoice_not_reviewable'; END IF;
  IF p_decision = 'rejected' AND length(btrim(coalesce(p_reason, ''))) < 5 THEN RAISE EXCEPTION 'supplier_rejection_reason_required'; END IF;
  UPDATE public.marketplace_oppe_supplier_invoices SET status = p_decision, review_reason = nullif(btrim(coalesce(p_reason, '')), ''),
    reviewed_by = p_actor, reviewed_at = now() WHERE id = p_invoice;
  INSERT INTO public.marketplace_events(case_id, binder_id, actor_user_id, event_type, metadata)
  VALUES (i.case_id, i.binder_id, p_actor, 'supplier_invoice_' || p_decision, jsonb_build_object('invoice_id', p_invoice, 'reason', nullif(btrim(coalesce(p_reason, '')), '')));
  RETURN p_decision;
END $$;

-- Règlement manuel : facture conforme, référence unique, jamais au-delà du TTC ; soldée = « payée ».
CREATE FUNCTION public.marketplace_record_supplier_payment(p_invoice uuid, p_paid_on date, p_amount integer, p_reference text, p_actor uuid)
RETURNS text
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE i public.marketplace_oppe_supplier_invoices%ROWTYPE; v_paid integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_actor AND role = 'admin') THEN RAISE EXCEPTION 'admin_required'; END IF;
  SELECT * INTO i FROM public.marketplace_oppe_supplier_invoices WHERE id = p_invoice FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'supplier_invoice_not_found'; END IF;
  IF i.status NOT IN ('accepted', 'paid') THEN RAISE EXCEPTION 'supplier_invoice_not_accepted'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'supplier_payment_amount_invalid'; END IF;
  IF p_paid_on IS NULL OR p_paid_on > (now() AT TIME ZONE 'Europe/Paris')::date THEN RAISE EXCEPTION 'supplier_payment_date_invalid'; END IF;
  SELECT coalesce(sum(amount_cents), 0) INTO v_paid FROM public.marketplace_oppe_supplier_payments WHERE invoice_id = p_invoice;
  IF v_paid + p_amount > i.amount_ttc_cents THEN RAISE EXCEPTION 'supplier_payment_exceeds_invoice'; END IF;
  INSERT INTO public.marketplace_oppe_supplier_payments(invoice_id, paid_on, amount_cents, reference, recorded_by)
  VALUES (p_invoice, p_paid_on, p_amount, btrim(p_reference), p_actor);
  IF v_paid + p_amount = i.amount_ttc_cents THEN
    UPDATE public.marketplace_oppe_supplier_invoices SET status = 'paid' WHERE id = p_invoice;
  END IF;
  INSERT INTO public.marketplace_events(case_id, binder_id, actor_user_id, event_type, metadata)
  VALUES (i.case_id, i.binder_id, p_actor, 'supplier_payment_recorded',
          jsonb_build_object('invoice_id', p_invoice, 'amount_cents', p_amount, 'reference', btrim(p_reference), 'settled', v_paid + p_amount = i.amount_ttc_cents));
  RETURN CASE WHEN v_paid + p_amount = i.amount_ttc_cents THEN 'paid' ELSE 'partial' END;
END $$;

REVOKE ALL ON FUNCTION public.marketplace_submit_supplier_invoice(uuid, uuid, text, text, date, text, integer, text, text, uuid),
  public.marketplace_review_supplier_invoice(uuid, text, text, uuid),
  public.marketplace_record_supplier_payment(uuid, date, integer, text, uuid),
  public.marketplace_forbid_supplier_payment_change(), public.marketplace_freeze_supplier_invoice_terms()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_submit_supplier_invoice(uuid, uuid, text, text, date, text, integer, text, text, uuid),
  public.marketplace_review_supplier_invoice(uuid, text, text, uuid),
  public.marketplace_record_supplier_payment(uuid, date, integer, text, uuid)
  TO service_role;

-- Dépôt privé des PDF : jamais lisible depuis le navigateur (URL signées par le serveur).
DO $$ BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('supplier-invoices-private', 'supplier-invoices-private', false, 5242880, ARRAY['application/pdf'])
    ON CONFLICT (id) DO NOTHING;
    EXECUTE $p$CREATE POLICY supplier_invoices_server_only ON storage.objects AS RESTRICTIVE
      FOR ALL TO anon, authenticated USING (bucket_id <> 'supplier-invoices-private')
      WITH CHECK (bucket_id <> 'supplier-invoices-private')$p$;
  END IF;
END $$;

-- Retour arrière (avant toute facture réelle) : DROP des fonctions, triggers et tables ci-dessus,
-- de la policy supplier_invoices_server_only et du bucket supplier-invoices-private (vide).
