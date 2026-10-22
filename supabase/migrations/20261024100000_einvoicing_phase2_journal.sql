-- Facturation, étape 2 : inaltérabilité prouvable, pour tous les émetteurs (chaque atelier et OPPE).
--
-- Un journal en ajout seul par émetteur (« binder:<uuid> » ou « oppe ») enregistre, dans l'ordre :
-- émissions de factures et d'avoirs, encaissements, PDF rangés, changements de préfixe, clôtures,
-- exports, anomalies. Chaque entrée porte l'empreinte SHA-256 de sa forme canonique et de l'empreinte
-- précédente du même émetteur : modifier, retirer ou intercaler une entrée casse la chaîne.
-- Format : docs/einvoicing/journal-format.md. Retour arrière : docs/einvoicing/phase2-rollback.sql.
--
-- Rien n'est réécrit dans les pièces existantes ; elles sont journalisées une fois, à la fin de la migration.

-- ---------------------------------------------------------------------------
-- 1. Forme canonique et empreinte.
-- ---------------------------------------------------------------------------
-- JSON sans espace, clés d'objet triées par point de code (COLLATE "C"), tableaux dans leur ordre,
-- chaînes échappées comme par la sortie texte de PostgreSQL, nombres tels que PostgreSQL les écrit.
CREATE OR REPLACE FUNCTION public.marketplace_canonical_json(p jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE t text := jsonb_typeof(p); r text;
BEGIN
  IF p IS NULL OR t = 'null' THEN RETURN 'null'; END IF;
  IF t = 'object' THEN
    SELECT '{' || coalesce(string_agg(to_json(e.key)::text || ':' || public.marketplace_canonical_json(e.value), ',' ORDER BY e.key COLLATE "C"), '') || '}'
      INTO r FROM jsonb_each(p) e;
    RETURN r;
  ELSIF t = 'array' THEN
    SELECT '[' || coalesce(string_agg(public.marketplace_canonical_json(e.value), ',' ORDER BY e.ord), '') || ']'
      INTO r FROM jsonb_array_elements(p) WITH ORDINALITY e(value, ord);
    RETURN r;
  END IF;
  RETURN p::text;
END $$;

CREATE OR REPLACE FUNCTION public.marketplace_journal_hash(p_prev text, p_canonical text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT encode(sha256(convert_to(p_prev || E'\n' || p_canonical, 'UTF8')), 'hex')
$$;

-- Restreint un objet « vivant » aux clés d'un modèle (récursif) : une colonne ajoutée plus tard à une
-- table ne fait pas passer une pièce intacte pour modifiée ; une colonne retirée, si.
CREATE OR REPLACE FUNCTION public.marketplace_jsonb_restrict(p_live jsonb, p_model jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF jsonb_typeof(p_model) = 'object' AND jsonb_typeof(p_live) = 'object' THEN
    SELECT coalesce(jsonb_object_agg(m.key, public.marketplace_jsonb_restrict(p_live -> m.key, m.value)), '{}'::jsonb)
      INTO r FROM jsonb_each(p_model) m WHERE p_live ? m.key;
    RETURN r;
  ELSIF jsonb_typeof(p_model) = 'array' AND jsonb_typeof(p_live) = 'array'
    AND jsonb_array_length(p_model) = jsonb_array_length(p_live) THEN
    SELECT coalesce(jsonb_agg(public.marketplace_jsonb_restrict(l.value, m.value) ORDER BY l.ord), '[]'::jsonb)
      INTO r FROM jsonb_array_elements(p_live) WITH ORDINALITY l(value, ord)
      JOIN jsonb_array_elements(p_model) WITH ORDINALITY m(value, ord) USING (ord);
    RETURN r;
  END IF;
  RETURN p_live;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Le journal, en ajout seul.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_issuer_journal (
  issuer_key text NOT NULL CHECK (issuer_key = 'oppe' OR issuer_key ~ '^binder:[0-9a-f-]{36}$'),
  seq bigint NOT NULL CHECK (seq > 0),
  event text NOT NULL CHECK (event IN ('issued', 'payment', 'refund', 'submitted', 'pdf_stored', 'prefix_change',
    'closure', 'export', 'pdf_integrity_failure', 'modification_refused', 'attestation_draft')),
  event_key text NOT NULL,
  document_kind text CHECK (document_kind IN ('binder_invoice', 'binder_credit_note', 'settlement', 'online_payment',
    'supplier_invoice', 'supplier_payment', 'oppe_invoice', 'oppe_credit_note', 'proposal_payment', 'oppe_refund')),
  document_id uuid,
  occurred_at timestamptz NOT NULL,
  actor text,
  payload jsonb NOT NULL,
  canonical text NOT NULL,
  prev_hash text NOT NULL CHECK (prev_hash ~ '^[0-9a-f]{64}$'),
  hash text NOT NULL UNIQUE CHECK (hash ~ '^[0-9a-f]{64}$'),
  PRIMARY KEY (issuer_key, seq),
  UNIQUE (issuer_key, event_key)
);
CREATE INDEX IF NOT EXISTS marketplace_issuer_journal_document_idx ON public.marketplace_issuer_journal (document_kind, document_id);
CREATE INDEX IF NOT EXISTS marketplace_issuer_journal_time_idx ON public.marketplace_issuer_journal (issuer_key, occurred_at);
ALTER TABLE public.marketplace_issuer_journal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access" ON public.marketplace_issuer_journal;
CREATE POLICY "No direct access" ON public.marketplace_issuer_journal FOR ALL USING (false);

CREATE OR REPLACE FUNCTION public.marketplace_issuer_journal_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'issuer_journal_append_only';
END $$;
DROP TRIGGER IF EXISTS marketplace_issuer_journal_append_only ON public.marketplace_issuer_journal;
CREATE TRIGGER marketplace_issuer_journal_append_only BEFORE UPDATE OR DELETE ON public.marketplace_issuer_journal
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_issuer_journal_append_only();
DROP TRIGGER IF EXISTS marketplace_issuer_journal_no_truncate ON public.marketplace_issuer_journal;
CREATE TRIGGER marketplace_issuer_journal_no_truncate BEFORE TRUNCATE ON public.marketplace_issuer_journal
  FOR EACH STATEMENT EXECUTE FUNCTION public.marketplace_issuer_journal_append_only();

-- L'enveloppe hachée : émetteur, rang, événement, clé, pièce, instant (UTC, microsecondes), auteur, contenu.
CREATE OR REPLACE FUNCTION public.marketplace_journal_envelope(
  p_issuer text, p_seq bigint, p_event text, p_event_key text, p_kind text, p_doc uuid, p_at timestamptz, p_actor text, p_payload jsonb
) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_object('issuer', p_issuer, 'seq', p_seq, 'event', p_event, 'event_key', p_event_key,
    'document_kind', p_kind, 'document_id', p_doc::text,
    'occurred_at', to_char(p_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'actor', p_actor, 'payload', p_payload)
$$;

-- Ajout interne (jamais ouvert au rôle de service) : verrou par émetteur, idempotent par clé d'événement.
CREATE OR REPLACE FUNCTION public.marketplace_journal_append(
  p_issuer text, p_event text, p_event_key text, p_kind text, p_doc uuid, p_payload jsonb, p_actor text
) RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_seq bigint; v_prev text; v_hash text; v_at timestamptz := public.marketplace_issue_clock(); v_canonical text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('marketplace_issuer_journal:' || p_issuer, 0));
  SELECT hash INTO v_hash FROM public.marketplace_issuer_journal WHERE issuer_key = p_issuer AND event_key = p_event_key;
  IF FOUND THEN RETURN v_hash; END IF;
  SELECT seq, hash INTO v_seq, v_prev FROM public.marketplace_issuer_journal WHERE issuer_key = p_issuer ORDER BY seq DESC LIMIT 1;
  v_seq := coalesce(v_seq, 0) + 1;
  v_prev := coalesce(v_prev, repeat('0', 64));
  v_canonical := public.marketplace_canonical_json(
    public.marketplace_journal_envelope(p_issuer, v_seq, p_event, p_event_key, p_kind, p_doc, v_at, p_actor, p_payload));
  v_hash := public.marketplace_journal_hash(v_prev, v_canonical);
  INSERT INTO public.marketplace_issuer_journal (issuer_key, seq, event, event_key, document_kind, document_id,
    occurred_at, actor, payload, canonical, prev_hash, hash)
  VALUES (p_issuer, v_seq, p_event, p_event_key, p_kind, p_doc, v_at, p_actor, p_payload, v_canonical, v_prev, v_hash);
  RETURN v_hash;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Contenu journalisé de chaque pièce : la ligne entière, moins ses seules colonnes légitimement mobiles.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marketplace_journal_document(p_kind text, p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE v jsonb; v_items jsonb;
BEGIN
  IF p_kind = 'binder_invoice' THEN
    SELECT to_jsonb(i) - ARRAY['status', 'updated_at', 'deposit_paid_cents', 'amount_paid_cents', 'payment_status', 'paid_at',
      'external_provider', 'external_invoice_id', 'external_status', 'electronic_invoice_status', 'electronic_invoice_sent_at',
      'external_metadata', 'electronic_invoice_provider', 'provider_invoice_id', 'provider_status', 'provider_sent_at',
      'reporting_status', 'pdf_path', 'pdf_sha256'] INTO v FROM public.marketplace_binder_invoices i WHERE i.id = p_id;
    SELECT coalesce(jsonb_agg(to_jsonb(it) - 'id' ORDER BY it.position), '[]'::jsonb) INTO v_items
      FROM public.marketplace_binder_invoice_items it WHERE it.invoice_id = p_id;
  ELSIF p_kind = 'binder_credit_note' THEN
    SELECT to_jsonb(c) - ARRAY['pdf_path', 'pdf_sha256'] INTO v FROM public.marketplace_binder_credit_notes c WHERE c.id = p_id;
    SELECT coalesce(jsonb_agg(to_jsonb(it) - 'id' ORDER BY it.position), '[]'::jsonb) INTO v_items
      FROM public.marketplace_binder_credit_note_items it WHERE it.credit_note_id = p_id;
  ELSIF p_kind = 'settlement' THEN
    SELECT to_jsonb(s) || jsonb_build_object('invoice_number', i.invoice_number) INTO v
      FROM public.marketplace_external_settlements s JOIN public.marketplace_binder_invoices i ON i.id = s.invoice_id WHERE s.id = p_id;
  ELSIF p_kind = 'supplier_invoice' THEN
    SELECT to_jsonb(s) - ARRAY['status', 'review_reason', 'reviewed_by', 'reviewed_at'] INTO v
      FROM public.marketplace_oppe_supplier_invoices s WHERE s.id = p_id;
  ELSIF p_kind = 'supplier_payment' THEN
    SELECT to_jsonb(p) || jsonb_build_object('binder_id', s.binder_id, 'invoice_number', s.invoice_number) INTO v
      FROM public.marketplace_oppe_supplier_payments p JOIN public.marketplace_oppe_supplier_invoices s ON s.id = p.invoice_id WHERE p.id = p_id;
  ELSIF p_kind = 'oppe_invoice' THEN
    SELECT to_jsonb(i) - ARRAY['pdf_path', 'pdf_sha256'] INTO v FROM public.marketplace_oppe_invoices i WHERE i.id = p_id;
    SELECT coalesce(jsonb_agg(to_jsonb(it) ORDER BY it.position), '[]'::jsonb) INTO v_items
      FROM public.marketplace_oppe_invoice_items it WHERE it.invoice_id = p_id;
  ELSIF p_kind = 'oppe_credit_note' THEN
    SELECT to_jsonb(c) - ARRAY['pdf_path', 'pdf_sha256'] INTO v FROM public.marketplace_oppe_credit_notes c WHERE c.id = p_id;
  ELSE
    RETURN NULL; -- paiements en ligne, paiements OPPE, remboursements : instantané à l'événement, sans relecture.
  END IF;
  IF v IS NULL THEN RETURN NULL; END IF;
  RETURN CASE WHEN v_items IS NULL THEN v ELSE v || jsonb_build_object('lines', v_items) END;
END $$;

-- Pièces dont le contenu est relu à la vérification (immuables par construction).
CREATE OR REPLACE FUNCTION public.marketplace_journal_rereadable(p_kind text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT p_kind IN ('binder_invoice', 'binder_credit_note', 'settlement', 'supplier_invoice', 'supplier_payment', 'oppe_invoice', 'oppe_credit_note')
$$;

-- ---------------------------------------------------------------------------
-- 4. Déclencheurs : chaque pièce et chaque encaissement entrent au journal à la validation de la transaction
--    (déclencheurs différés : les lignes d'une pièce sont alors toutes écrites).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marketplace_journal_on_document()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- Les champs sont lus dans to_jsonb(NEW) : une expression qui nommerait NEW.invoice_id échouerait sur les tables qui n'ont pas cette colonne.
DECLARE v_kind text := TG_ARGV[0]; v_event text := TG_ARGV[1]; v_issuer text; v_key text; v_payload jsonb; v_row jsonb := to_jsonb(NEW);
BEGIN
  v_issuer := CASE
    WHEN v_kind IN ('binder_invoice', 'binder_credit_note', 'online_payment', 'supplier_invoice') THEN 'binder:' || (v_row ->> 'binder_id')
    WHEN v_kind = 'settlement' THEN 'binder:' || (SELECT binder_id::text FROM public.marketplace_binder_invoices WHERE id = (v_row ->> 'invoice_id')::uuid)
    WHEN v_kind = 'supplier_payment' THEN 'binder:' || (SELECT binder_id::text FROM public.marketplace_oppe_supplier_invoices WHERE id = (v_row ->> 'invoice_id')::uuid)
    ELSE 'oppe' END;
  IF v_event = 'pdf_stored' THEN
    v_key := 'pdf_stored:' || v_kind || ':' || (v_row ->> 'id');
    v_payload := jsonb_build_object('document_kind', v_kind, 'document_id', v_row ->> 'id', 'path', v_row ->> 'pdf_path', 'sha256', v_row ->> 'pdf_sha256');
  ELSIF v_kind = 'online_payment' AND v_event = 'refund' THEN
    v_key := 'refund:online_payment:' || (v_row ->> 'id') || ':' || (v_row ->> 'refunded_cents');
    v_payload := jsonb_build_object('payment_id', v_row ->> 'id', 'invoice_id', v_row ->> 'invoice_id', 'method', 'carte',
      'refunded_total_cents', (v_row ->> 'refunded_cents')::bigint,
      'refund_cents', (v_row ->> 'refunded_cents')::bigint - coalesce((to_jsonb(OLD) ->> 'refunded_cents')::bigint, 0),
      'currency', v_row ->> 'currency', 'payment_intent_id', v_row ->> 'payment_intent_id');
  ELSIF v_kind = 'online_payment' THEN
    v_key := 'payment:online_payment:' || (v_row ->> 'id');
    v_payload := jsonb_build_object('payment_id', v_row ->> 'id', 'invoice_id', v_row ->> 'invoice_id', 'method', 'carte',
      'amount_cents', (v_row ->> 'amount_cents')::bigint, 'currency', v_row ->> 'currency',
      'paid_at', v_row ->> 'paid_at', 'payment_intent_id', v_row ->> 'payment_intent_id');
  ELSIF v_kind = 'proposal_payment' THEN
    v_key := 'payment:proposal_payment:' || (v_row ->> 'proposal_id');
    v_payload := jsonb_build_object('proposal_id', v_row ->> 'proposal_id', 'method', 'carte',
      'amount_cents', (v_row ->> 'amount_paid_cents')::bigint, 'currency', v_row ->> 'paid_currency', 'paid_at', v_row ->> 'paid_at',
      'payment_intent_id', v_row ->> 'stripe_payment_intent_id',
      'invoice_number', (SELECT number FROM public.marketplace_oppe_invoices WHERE proposal_id = (v_row ->> 'proposal_id')::uuid));
  ELSIF v_kind = 'oppe_refund' THEN
    v_key := 'refund:oppe_refund:' || (v_row ->> 'id');
    v_payload := jsonb_build_object('refund_id', v_row ->> 'id', 'invoice_id', v_row ->> 'invoice_id', 'method', 'carte',
      'refund_cents', (v_row ->> 'amount_cents')::bigint, 'currency', v_row ->> 'currency', 'stripe_refund_id', v_row ->> 'stripe_refund_id',
      'credit_note_id', v_row ->> 'credit_note_id');
  ELSE
    v_key := v_event || ':' || v_kind || ':' || (v_row ->> 'id');
    v_payload := public.marketplace_journal_document(v_kind, (v_row ->> 'id')::uuid);
  END IF;
  IF v_issuer IS NULL OR v_payload IS NULL THEN RAISE EXCEPTION 'issuer_journal_unresolved % %', v_kind, v_row ->> 'id'; END IF;
  PERFORM public.marketplace_journal_append(v_issuer, v_event, v_key,
    v_kind, coalesce(v_row ->> 'id', v_row ->> 'proposal_id')::uuid, v_payload, 'system');
  RETURN NULL;
END $$;

-- Factures d'atelier : à l'émission, puis à la pose du PDF.
DROP TRIGGER IF EXISTS marketplace_journal_binder_invoice_issued ON public.marketplace_binder_invoices;
CREATE CONSTRAINT TRIGGER marketplace_journal_binder_invoice_issued AFTER UPDATE ON public.marketplace_binder_invoices
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (OLD.status = 'draft' AND NEW.status IN ('issued', 'credited'))
  EXECUTE FUNCTION public.marketplace_journal_on_document('binder_invoice', 'issued');
DROP TRIGGER IF EXISTS marketplace_journal_binder_invoice_pdf ON public.marketplace_binder_invoices;
CREATE CONSTRAINT TRIGGER marketplace_journal_binder_invoice_pdf AFTER UPDATE ON public.marketplace_binder_invoices
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (OLD.pdf_sha256 IS NULL AND NEW.pdf_sha256 IS NOT NULL)
  EXECUTE FUNCTION public.marketplace_journal_on_document('binder_invoice', 'pdf_stored');
-- Avoirs d'atelier.
DROP TRIGGER IF EXISTS marketplace_journal_binder_credit_note_issued ON public.marketplace_binder_credit_notes;
CREATE CONSTRAINT TRIGGER marketplace_journal_binder_credit_note_issued AFTER INSERT ON public.marketplace_binder_credit_notes
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.marketplace_journal_on_document('binder_credit_note', 'issued');
DROP TRIGGER IF EXISTS marketplace_journal_binder_credit_note_pdf ON public.marketplace_binder_credit_notes;
CREATE CONSTRAINT TRIGGER marketplace_journal_binder_credit_note_pdf AFTER UPDATE ON public.marketplace_binder_credit_notes
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (OLD.pdf_sha256 IS NULL AND NEW.pdf_sha256 IS NOT NULL)
  EXECUTE FUNCTION public.marketplace_journal_on_document('binder_credit_note', 'pdf_stored');
-- Règlements déclarés (règlement, remboursement, litige).
DROP TRIGGER IF EXISTS marketplace_journal_settlement ON public.marketplace_external_settlements;
CREATE CONSTRAINT TRIGGER marketplace_journal_settlement AFTER INSERT ON public.marketplace_external_settlements
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.marketplace_journal_on_document('settlement', 'payment');
-- Paiements en ligne d'atelier : payé, puis chaque remboursement.
DROP TRIGGER IF EXISTS marketplace_journal_online_payment_paid ON public.marketplace_workshop_online_payments;
CREATE CONSTRAINT TRIGGER marketplace_journal_online_payment_paid AFTER UPDATE ON public.marketplace_workshop_online_payments
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (OLD.paid_at IS NULL AND NEW.paid_at IS NOT NULL)
  EXECUTE FUNCTION public.marketplace_journal_on_document('online_payment', 'payment');
DROP TRIGGER IF EXISTS marketplace_journal_online_payment_refund ON public.marketplace_workshop_online_payments;
CREATE CONSTRAINT TRIGGER marketplace_journal_online_payment_refund AFTER UPDATE ON public.marketplace_workshop_online_payments
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.refunded_cents > OLD.refunded_cents)
  EXECUTE FUNCTION public.marketplace_journal_on_document('online_payment', 'refund');
-- Factures d'atelier à OPPE et leurs paiements.
DROP TRIGGER IF EXISTS marketplace_journal_supplier_invoice ON public.marketplace_oppe_supplier_invoices;
CREATE CONSTRAINT TRIGGER marketplace_journal_supplier_invoice AFTER INSERT ON public.marketplace_oppe_supplier_invoices
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.marketplace_journal_on_document('supplier_invoice', 'submitted');
DROP TRIGGER IF EXISTS marketplace_journal_supplier_payment ON public.marketplace_oppe_supplier_payments;
CREATE CONSTRAINT TRIGGER marketplace_journal_supplier_payment AFTER INSERT ON public.marketplace_oppe_supplier_payments
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.marketplace_journal_on_document('supplier_payment', 'payment');
-- OPPE : factures, avoirs, paiements, remboursements.
DROP TRIGGER IF EXISTS marketplace_journal_oppe_invoice ON public.marketplace_oppe_invoices;
CREATE CONSTRAINT TRIGGER marketplace_journal_oppe_invoice AFTER INSERT ON public.marketplace_oppe_invoices
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.marketplace_journal_on_document('oppe_invoice', 'issued');
DROP TRIGGER IF EXISTS marketplace_journal_oppe_credit_note ON public.marketplace_oppe_credit_notes;
CREATE CONSTRAINT TRIGGER marketplace_journal_oppe_credit_note AFTER INSERT ON public.marketplace_oppe_credit_notes
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.marketplace_journal_on_document('oppe_credit_note', 'issued');
DROP TRIGGER IF EXISTS marketplace_journal_proposal_payment_insert ON public.marketplace_commercial_proposal_payments;
CREATE CONSTRAINT TRIGGER marketplace_journal_proposal_payment_insert AFTER INSERT ON public.marketplace_commercial_proposal_payments
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.paid_at IS NOT NULL)
  EXECUTE FUNCTION public.marketplace_journal_on_document('proposal_payment', 'payment');
DROP TRIGGER IF EXISTS marketplace_journal_proposal_payment_update ON public.marketplace_commercial_proposal_payments;
CREATE CONSTRAINT TRIGGER marketplace_journal_proposal_payment_update AFTER UPDATE ON public.marketplace_commercial_proposal_payments
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (OLD.paid_at IS NULL AND NEW.paid_at IS NOT NULL)
  EXECUTE FUNCTION public.marketplace_journal_on_document('proposal_payment', 'payment');
DROP TRIGGER IF EXISTS marketplace_journal_oppe_refund_insert ON public.marketplace_oppe_refunds;
CREATE CONSTRAINT TRIGGER marketplace_journal_oppe_refund_insert AFTER INSERT ON public.marketplace_oppe_refunds
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.status = 'succeeded')
  EXECUTE FUNCTION public.marketplace_journal_on_document('oppe_refund', 'refund');
DROP TRIGGER IF EXISTS marketplace_journal_oppe_refund_update ON public.marketplace_oppe_refunds;
CREATE CONSTRAINT TRIGGER marketplace_journal_oppe_refund_update AFTER UPDATE ON public.marketplace_oppe_refunds
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM 'succeeded' AND NEW.status = 'succeeded')
  EXECUTE FUNCTION public.marketplace_journal_on_document('oppe_refund', 'refund');

-- Changement de préfixe (immédiat, mis en attente ou appliqué au 1er janvier).
CREATE OR REPLACE FUNCTION public.marketplace_journal_on_prefix_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.marketplace_journal_append('binder:' || NEW.binder_id, 'prefix_change',
    'prefix_change:' || md5(concat_ws('|', NEW.invoice_prefix, NEW.credit_note_prefix, NEW.invoice_prefix_pending,
      NEW.credit_note_prefix_pending, NEW.prefix_pending_from_year, public.marketplace_issue_clock())),
    NULL, NULL, jsonb_build_object(
      'invoice_prefix', jsonb_build_object('before', OLD.invoice_prefix, 'after', NEW.invoice_prefix),
      'credit_note_prefix', jsonb_build_object('before', OLD.credit_note_prefix, 'after', NEW.credit_note_prefix),
      'invoice_prefix_pending', NEW.invoice_prefix_pending, 'credit_note_prefix_pending', NEW.credit_note_prefix_pending,
      'prefix_pending_from_year', NEW.prefix_pending_from_year), 'system');
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS marketplace_journal_prefix_change ON public.marketplace_binder_billing_profiles;
CREATE TRIGGER marketplace_journal_prefix_change AFTER UPDATE ON public.marketplace_binder_billing_profiles
  FOR EACH ROW WHEN (OLD.invoice_prefix IS DISTINCT FROM NEW.invoice_prefix
    OR OLD.credit_note_prefix IS DISTINCT FROM NEW.credit_note_prefix
    OR OLD.invoice_prefix_pending IS DISTINCT FROM NEW.invoice_prefix_pending
    OR OLD.credit_note_prefix_pending IS DISTINCT FROM NEW.credit_note_prefix_pending
    OR OLD.prefix_pending_from_year IS DISTINCT FROM NEW.prefix_pending_from_year)
  EXECUTE FUNCTION public.marketplace_journal_on_prefix_change();

-- ---------------------------------------------------------------------------
-- 5. PDF des pièces OPPE : rangés une fois, comme ceux des ateliers.
-- ---------------------------------------------------------------------------
ALTER TABLE public.marketplace_oppe_invoices ADD COLUMN IF NOT EXISTS pdf_path text, ADD COLUMN IF NOT EXISTS pdf_sha256 text;
ALTER TABLE public.marketplace_oppe_credit_notes ADD COLUMN IF NOT EXISTS pdf_path text, ADD COLUMN IF NOT EXISTS pdf_sha256 text;
ALTER TABLE public.marketplace_oppe_invoices DROP CONSTRAINT IF EXISTS marketplace_oppe_invoices_pdf_check;
ALTER TABLE public.marketplace_oppe_invoices ADD CONSTRAINT marketplace_oppe_invoices_pdf_check
  CHECK ((pdf_path IS NULL) = (pdf_sha256 IS NULL) AND (pdf_sha256 IS NULL OR pdf_sha256 ~ '^[0-9a-f]{64}$'));
ALTER TABLE public.marketplace_oppe_credit_notes DROP CONSTRAINT IF EXISTS marketplace_oppe_credit_notes_pdf_check;
ALTER TABLE public.marketplace_oppe_credit_notes ADD CONSTRAINT marketplace_oppe_credit_notes_pdf_check
  CHECK ((pdf_path IS NULL) = (pdf_sha256 IS NULL) AND (pdf_sha256 IS NULL OR pdf_sha256 ~ '^[0-9a-f]{64}$'));

CREATE OR REPLACE FUNCTION public.marketplace_forbid_oppe_document_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Seule exception : la pose unique du PDF et de son empreinte sur une facture ou un avoir OPPE.
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME IN ('marketplace_oppe_invoices', 'marketplace_oppe_credit_notes')
    AND (to_jsonb(NEW) - ARRAY['pdf_path', 'pdf_sha256']) = (to_jsonb(OLD) - ARRAY['pdf_path', 'pdf_sha256'])
    AND to_jsonb(OLD) ->> 'pdf_path' IS NULL THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'oppe_document_immutable';
END $$;
GRANT UPDATE (pdf_path, pdf_sha256) ON public.marketplace_oppe_invoices, public.marketplace_oppe_credit_notes TO service_role;

DROP TRIGGER IF EXISTS marketplace_journal_oppe_invoice_pdf ON public.marketplace_oppe_invoices;
CREATE CONSTRAINT TRIGGER marketplace_journal_oppe_invoice_pdf AFTER UPDATE ON public.marketplace_oppe_invoices
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (OLD.pdf_sha256 IS NULL AND NEW.pdf_sha256 IS NOT NULL)
  EXECUTE FUNCTION public.marketplace_journal_on_document('oppe_invoice', 'pdf_stored');
DROP TRIGGER IF EXISTS marketplace_journal_oppe_credit_note_pdf ON public.marketplace_oppe_credit_notes;
CREATE CONSTRAINT TRIGGER marketplace_journal_oppe_credit_note_pdf AFTER UPDATE ON public.marketplace_oppe_credit_notes
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (OLD.pdf_sha256 IS NULL AND NEW.pdf_sha256 IS NOT NULL)
  EXECUTE FUNCTION public.marketplace_journal_on_document('oppe_credit_note', 'pdf_stored');

-- ---------------------------------------------------------------------------
-- 6. Vérification d'intégrité d'un émetteur.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marketplace_journal_verify(p_issuer text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e record; v_prev text := repeat('0', 64); v_expected bigint := 1; v_canonical text; v_live jsonb;
  v_problems jsonb := '[]'::jsonb; v_count bigint := 0; v_last text := NULL; v_binder uuid;
BEGIN
  FOR e IN SELECT * FROM public.marketplace_issuer_journal WHERE issuer_key = p_issuer ORDER BY seq LOOP
    v_count := v_count + 1;
    IF e.seq <> v_expected THEN
      v_problems := v_problems || jsonb_build_object('seq', e.seq, 'problem', 'seq_gap', 'expected', v_expected);
    END IF;
    IF e.prev_hash <> v_prev THEN
      v_problems := v_problems || jsonb_build_object('seq', e.seq, 'problem', 'prev_hash_mismatch');
    END IF;
    v_canonical := public.marketplace_canonical_json(public.marketplace_journal_envelope(e.issuer_key, e.seq, e.event, e.event_key,
      e.document_kind, e.document_id, e.occurred_at, e.actor, e.payload));
    IF v_canonical <> e.canonical THEN
      v_problems := v_problems || jsonb_build_object('seq', e.seq, 'problem', 'canonical_mismatch');
    END IF;
    IF public.marketplace_journal_hash(e.prev_hash, e.canonical) <> e.hash THEN
      v_problems := v_problems || jsonb_build_object('seq', e.seq, 'problem', 'hash_mismatch');
    END IF;
    IF e.event IN ('issued', 'payment', 'submitted') AND public.marketplace_journal_rereadable(e.document_kind) THEN
      v_live := public.marketplace_journal_document(e.document_kind, e.document_id);
      IF v_live IS NULL THEN
        v_problems := v_problems || jsonb_build_object('seq', e.seq, 'problem', 'document_missing', 'document_kind', e.document_kind, 'document_id', e.document_id);
      ELSIF public.marketplace_jsonb_restrict(v_live, e.payload) IS DISTINCT FROM e.payload THEN
        v_problems := v_problems || jsonb_build_object('seq', e.seq, 'problem', 'document_modified', 'document_kind', e.document_kind, 'document_id', e.document_id);
      END IF;
    ELSIF e.event = 'pdf_stored' THEN
      SELECT CASE e.document_kind
        WHEN 'binder_invoice' THEN (SELECT pdf_sha256 FROM public.marketplace_binder_invoices WHERE id = e.document_id)
        WHEN 'binder_credit_note' THEN (SELECT pdf_sha256 FROM public.marketplace_binder_credit_notes WHERE id = e.document_id)
        WHEN 'oppe_invoice' THEN (SELECT pdf_sha256 FROM public.marketplace_oppe_invoices WHERE id = e.document_id)
        WHEN 'oppe_credit_note' THEN (SELECT pdf_sha256 FROM public.marketplace_oppe_credit_notes WHERE id = e.document_id) END
        INTO v_last;
      IF v_last IS DISTINCT FROM e.payload ->> 'sha256' THEN
        v_problems := v_problems || jsonb_build_object('seq', e.seq, 'problem', 'pdf_hash_changed', 'document_kind', e.document_kind, 'document_id', e.document_id);
      END IF;
    END IF;
    v_prev := e.hash;
    v_expected := e.seq + 1;
  END LOOP;

  -- Exhaustivité : toute pièce émise et tout encaissement de l'émetteur figurent au journal.
  IF p_issuer LIKE 'binder:%' THEN
    v_binder := substr(p_issuer, 8)::uuid;
    v_problems := v_problems || coalesce((SELECT jsonb_agg(jsonb_build_object('problem', 'document_not_journaled', 'document_kind', k, 'document_id', id))
      FROM (
        SELECT 'binder_invoice' k, id FROM public.marketplace_binder_invoices WHERE binder_id = v_binder AND status IN ('issued', 'credited')
        UNION ALL SELECT 'binder_credit_note', id FROM public.marketplace_binder_credit_notes WHERE binder_id = v_binder
        UNION ALL SELECT 'settlement', s.id FROM public.marketplace_external_settlements s JOIN public.marketplace_binder_invoices i ON i.id = s.invoice_id WHERE i.binder_id = v_binder
        UNION ALL SELECT 'supplier_invoice', id FROM public.marketplace_oppe_supplier_invoices WHERE binder_id = v_binder
      ) d WHERE NOT EXISTS (SELECT 1 FROM public.marketplace_issuer_journal j WHERE j.issuer_key = p_issuer AND j.document_kind = d.k AND j.document_id = d.id)), '[]'::jsonb);
  ELSIF p_issuer = 'oppe' THEN
    v_problems := v_problems || coalesce((SELECT jsonb_agg(jsonb_build_object('problem', 'document_not_journaled', 'document_kind', k, 'document_id', id))
      FROM (
        SELECT 'oppe_invoice' k, id FROM public.marketplace_oppe_invoices
        UNION ALL SELECT 'oppe_credit_note', id FROM public.marketplace_oppe_credit_notes
      ) d WHERE NOT EXISTS (SELECT 1 FROM public.marketplace_issuer_journal j WHERE j.issuer_key = 'oppe' AND j.document_kind = d.k AND j.document_id = d.id)), '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object('issuer', p_issuer, 'ok', jsonb_array_length(v_problems) = 0, 'entries', v_count,
    'last_seq', v_expected - 1, 'last_hash', v_prev, 'problems', v_problems,
    'verified_at', to_char(public.marketplace_issue_clock() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
END $$;

-- ---------------------------------------------------------------------------
-- 7. Clôtures journalières, mensuelles et annuelles, chaînées, calculées sur le journal lui-même.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marketplace_journal_period_totals(p_issuer text, p_start date, p_end date)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  WITH entries AS (
    SELECT * FROM public.marketplace_issuer_journal
    WHERE issuer_key = p_issuer AND public.marketplace_paris_date(occurred_at) >= p_start AND public.marketplace_paris_date(occurred_at) < p_end
  ), docs AS (
    SELECT CASE WHEN document_kind IN ('binder_credit_note', 'oppe_credit_note') THEN -1 ELSE 1 END AS sign, document_kind, payload
    FROM entries WHERE event = 'issued'
  ), vat AS (
    SELECT coalesce((b ->> 'vatRateBps'), (b ->> 'rate_bps'))::bigint AS rate,
      sum(d.sign * coalesce((b ->> 'baseHtCents'), (b ->> 'base_ht_cents'))::bigint) AS base,
      sum(d.sign * coalesce((b ->> 'vatCents'), (b ->> 'vat_cents'))::bigint) AS vat
    FROM docs d CROSS JOIN LATERAL jsonb_array_elements(coalesce(d.payload -> 'vat_breakdown', '[]'::jsonb)) b GROUP BY 1
  ), money AS (
    SELECT CASE
        WHEN document_kind = 'settlement' THEN payload ->> 'payment_method'
        WHEN document_kind = 'supplier_payment' THEN 'virement'
        ELSE coalesce(payload ->> 'method', 'autre') END AS method,
      sum(CASE
        WHEN document_kind = 'settlement' AND payload ->> 'kind' = 'receipt' THEN (payload ->> 'amount_cents')::bigint
        WHEN document_kind = 'settlement' AND payload ->> 'kind' = 'refund' THEN -(payload ->> 'amount_cents')::bigint
        WHEN document_kind = 'settlement' THEN 0
        WHEN event = 'refund' THEN -(payload ->> 'refund_cents')::bigint
        ELSE coalesce((payload ->> 'amount_cents')::bigint, 0) END) AS amount
    FROM entries WHERE event IN ('payment', 'refund') GROUP BY 1
  )
  SELECT jsonb_build_object(
    'entries', (SELECT count(*) FROM entries),
    'first_seq', (SELECT min(seq) FROM entries), 'last_seq', (SELECT max(seq) FROM entries),
    'invoices', (SELECT count(*) FROM docs WHERE sign = 1), 'credit_notes', (SELECT count(*) FROM docs WHERE sign = -1),
    'total_ht_cents', coalesce((SELECT sum(sign * (payload ->> 'total_ht_cents')::bigint) FROM docs), 0),
    'total_vat_cents', coalesce((SELECT sum(sign * (payload ->> 'total_vat_cents')::bigint) FROM docs), 0),
    'total_ttc_cents', coalesce((SELECT sum(sign * (payload ->> 'total_ttc_cents')::bigint) FROM docs), 0),
    'vat_by_rate', coalesce((SELECT jsonb_agg(jsonb_build_object('rate_bps', rate, 'base_ht_cents', base, 'vat_cents', vat) ORDER BY rate) FROM vat), '[]'::jsonb),
    'payments_by_method', coalesce((SELECT jsonb_object_agg(method, amount) FROM money), '{}'::jsonb))
$$;

CREATE OR REPLACE FUNCTION public.marketplace_journal_close_period(p_issuer text, p_kind text, p_start date)
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_end date; v_key text; v_prev_closure text; v_last record;
BEGIN
  v_end := CASE p_kind WHEN 'day' THEN p_start + 1 WHEN 'month' THEN (p_start + interval '1 month')::date
    WHEN 'year' THEN (p_start + interval '1 year')::date END;
  IF v_end IS NULL THEN RAISE EXCEPTION 'closure_kind_invalid'; END IF;
  IF v_end > public.marketplace_paris_date(public.marketplace_issue_clock()) THEN RAISE EXCEPTION 'closure_period_not_over'; END IF;
  v_key := 'closure:' || p_kind || ':' || to_char(p_start, 'YYYY-MM-DD');
  SELECT hash INTO v_prev_closure FROM public.marketplace_issuer_journal
    WHERE issuer_key = p_issuer AND event = 'closure' AND payload ->> 'kind' = p_kind ORDER BY seq DESC LIMIT 1;
  SELECT seq, hash INTO v_last FROM public.marketplace_issuer_journal
    WHERE issuer_key = p_issuer AND public.marketplace_paris_date(occurred_at) < v_end ORDER BY seq DESC LIMIT 1;
  RETURN public.marketplace_journal_append(p_issuer, 'closure', v_key, NULL, NULL,
    jsonb_build_object('kind', p_kind, 'period_start', p_start::text, 'period_end', v_end::text,
      'previous_closure_hash', v_prev_closure, 'covered_last_seq', v_last.seq, 'covered_last_hash', v_last.hash)
      || public.marketplace_journal_period_totals(p_issuer, p_start, v_end),
    'system');
END $$;

-- Rattrapage : toutes les périodes échues et non closes, de la première activité à hier (jour),
-- au mois dernier (mois), à l'an dernier (année). Idempotent ; appelé par la tâche planifiée et
-- avant chaque vérification ou export.
CREATE OR REPLACE FUNCTION public.marketplace_journal_close_due(p_issuer text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i record; d date; v_today date := public.marketplace_paris_date(public.marketplace_issue_clock()); v_first date; v_n integer := 0;
BEGIN
  FOR i IN SELECT issuer_key, min(public.marketplace_paris_date(occurred_at)) AS first_day FROM public.marketplace_issuer_journal
    WHERE (p_issuer IS NULL OR issuer_key = p_issuer) AND event <> 'closure' GROUP BY 1 LOOP
    v_first := i.first_day;
    -- Jours : seulement ceux où il s'est passé quelque chose (coût négligeable, aucune entrée vide).
    FOR d IN SELECT DISTINCT public.marketplace_paris_date(occurred_at) FROM public.marketplace_issuer_journal
      WHERE issuer_key = i.issuer_key AND event <> 'closure' AND public.marketplace_paris_date(occurred_at) < v_today ORDER BY 1 LOOP
      IF NOT EXISTS (SELECT 1 FROM public.marketplace_issuer_journal WHERE issuer_key = i.issuer_key AND event_key = 'closure:day:' || to_char(d, 'YYYY-MM-DD')) THEN
        PERFORM public.marketplace_journal_close_period(i.issuer_key, 'day', d); v_n := v_n + 1;
      END IF;
    END LOOP;
    -- Mois et années : continus, y compris vides, de la première activité à la dernière période échue.
    d := date_trunc('month', v_first)::date;
    WHILE (d + interval '1 month')::date <= v_today LOOP
      IF NOT EXISTS (SELECT 1 FROM public.marketplace_issuer_journal WHERE issuer_key = i.issuer_key AND event_key = 'closure:month:' || to_char(d, 'YYYY-MM-DD')) THEN
        PERFORM public.marketplace_journal_close_period(i.issuer_key, 'month', d); v_n := v_n + 1;
      END IF;
      d := (d + interval '1 month')::date;
    END LOOP;
    d := date_trunc('year', v_first)::date;
    WHILE (d + interval '1 year')::date <= v_today LOOP
      IF NOT EXISTS (SELECT 1 FROM public.marketplace_issuer_journal WHERE issuer_key = i.issuer_key AND event_key = 'closure:year:' || to_char(d, 'YYYY-MM-DD')) THEN
        PERFORM public.marketplace_journal_close_period(i.issuer_key, 'year', d); v_n := v_n + 1;
      END IF;
      d := (d + interval '1 year')::date;
    END LOOP;
  END LOOP;
  RETURN v_n;
END $$;

-- ---------------------------------------------------------------------------
-- 8. Événements de l'application (export, anomalie de PDF, modification refusée, modèle d'attestation).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marketplace_journal_record_event(p_issuer text, p_event text, p_payload jsonb, p_actor uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_event NOT IN ('export', 'pdf_integrity_failure', 'modification_refused', 'attestation_draft') THEN
    RAISE EXCEPTION 'issuer_journal_event_not_allowed';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN RAISE EXCEPTION 'issuer_journal_payload_invalid'; END IF;
  RETURN public.marketplace_journal_append(p_issuer, p_event, p_event || ':' || gen_random_uuid(), NULL, NULL, p_payload,
    coalesce(p_actor::text, 'system'));
END $$;

-- ---------------------------------------------------------------------------
-- 9. Conservation : supprimer un atelier, un devis, un dossier ou une proposition ne supprime plus
--    (Relu à la main : le SQL dynamique ci-dessous ne fait que remplacer des clés étrangères, il ne crée aucune table.)
-- acl: dynamic-reviewed
--    aucune pièce, aucun encaissement, aucun compteur.
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record; v_def text;
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid::regclass AS tbl, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    WHERE c.contype = 'f' AND c.confdeltype IN ('c', 'n', 'd')
      AND c.conrelid = ANY (ARRAY[
        'public.marketplace_binder_invoices', 'public.marketplace_binder_invoice_items',
        'public.marketplace_binder_credit_notes', 'public.marketplace_binder_credit_note_items',
        'public.marketplace_binder_document_counters', 'public.marketplace_external_settlements',
        'public.marketplace_workshop_online_payments', 'public.marketplace_oppe_invoices',
        'public.marketplace_oppe_invoice_items', 'public.marketplace_oppe_credit_notes', 'public.marketplace_oppe_refunds',
        'public.marketplace_commercial_proposal_payments', 'public.marketplace_oppe_supplier_invoices',
        'public.marketplace_oppe_supplier_payments', 'public.marketplace_oppe_document_counters'
      ]::regclass[])
  LOOP
    v_def := regexp_replace(r.def, 'ON DELETE (CASCADE|SET NULL|SET DEFAULT)', 'ON DELETE RESTRICT');
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I, ADD CONSTRAINT %I %s', r.tbl, r.conname, r.conname, v_def);
    RAISE NOTICE 'retention_restrict % . % : % -> %', r.tbl, r.conname, r.def, v_def;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 10. Droits.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.marketplace_issuer_journal FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.marketplace_issuer_journal TO service_role;
REVOKE ALL ON FUNCTION public.marketplace_journal_append(text, text, text, text, uuid, jsonb, text),
  public.marketplace_journal_close_period(text, text, date), public.marketplace_journal_on_document(),
  public.marketplace_journal_on_prefix_change(), public.marketplace_journal_document(text, uuid),
  public.marketplace_journal_period_totals(text, date, date)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.marketplace_journal_verify(text), public.marketplace_journal_close_due(text),
  public.marketplace_journal_record_event(text, text, jsonb, uuid), public.marketplace_canonical_json(jsonb),
  public.marketplace_journal_hash(text, text), public.marketplace_jsonb_restrict(jsonb, jsonb),
  public.marketplace_journal_envelope(text, bigint, text, text, text, uuid, timestamptz, text, jsonb),
  public.marketplace_journal_rereadable(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_journal_verify(text), public.marketplace_journal_close_due(text),
  public.marketplace_journal_record_event(text, text, jsonb, uuid), public.marketplace_canonical_json(jsonb),
  public.marketplace_journal_hash(text, text), public.marketplace_jsonb_restrict(jsonb, jsonb),
  public.marketplace_journal_envelope(text, bigint, text, text, text, uuid, timestamptz, text, jsonb),
  public.marketplace_journal_rereadable(text)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 11. Journalisation initiale des pièces existantes, dans l'ordre de leur émission (auteur « backfill »).
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record; v_issuer text;
BEGIN
  FOR r IN
    SELECT * FROM (
      SELECT 'binder_invoice' k, 'issued' ev, id, 'binder:' || binder_id AS issuer, coalesce(issued_at, updated_at) AS at
        FROM public.marketplace_binder_invoices WHERE status IN ('issued', 'credited')
      UNION ALL SELECT 'binder_credit_note', 'issued', id, 'binder:' || binder_id, created_at FROM public.marketplace_binder_credit_notes
      UNION ALL SELECT 'settlement', 'payment', s.id, 'binder:' || i.binder_id, s.created_at
        FROM public.marketplace_external_settlements s JOIN public.marketplace_binder_invoices i ON i.id = s.invoice_id
      UNION ALL SELECT 'supplier_invoice', 'submitted', id, 'binder:' || binder_id, created_at FROM public.marketplace_oppe_supplier_invoices
      UNION ALL SELECT 'supplier_payment', 'payment', p.id, 'binder:' || s.binder_id, p.created_at
        FROM public.marketplace_oppe_supplier_payments p JOIN public.marketplace_oppe_supplier_invoices s ON s.id = p.invoice_id
      UNION ALL SELECT 'oppe_invoice', 'issued', id, 'oppe', issued_at FROM public.marketplace_oppe_invoices
      UNION ALL SELECT 'oppe_credit_note', 'issued', id, 'oppe', issued_at FROM public.marketplace_oppe_credit_notes
    ) x ORDER BY at, k, id
  LOOP
    PERFORM public.marketplace_journal_append(r.issuer, r.ev, r.ev || ':' || r.k || ':' || r.id, r.k, r.id,
      public.marketplace_journal_document(r.k, r.id), 'backfill');
  END LOOP;
  -- Encaissements en ligne et paiements OPPE déjà reçus, et PDF déjà rangés.
  FOR r IN SELECT * FROM public.marketplace_workshop_online_payments WHERE paid_at IS NOT NULL ORDER BY paid_at LOOP
    PERFORM public.marketplace_journal_append('binder:' || r.binder_id, 'payment', 'payment:online_payment:' || r.id, 'online_payment', r.id,
      jsonb_build_object('payment_id', r.id, 'invoice_id', r.invoice_id, 'method', 'carte', 'amount_cents', r.amount_cents,
        'currency', r.currency, 'paid_at', r.paid_at, 'payment_intent_id', r.payment_intent_id), 'backfill');
    IF r.refunded_cents > 0 THEN
      PERFORM public.marketplace_journal_append('binder:' || r.binder_id, 'refund', 'refund:online_payment:' || r.id || ':' || r.refunded_cents,
        'online_payment', r.id, jsonb_build_object('payment_id', r.id, 'invoice_id', r.invoice_id, 'method', 'carte',
          'refunded_total_cents', r.refunded_cents, 'refund_cents', r.refunded_cents, 'currency', r.currency,
          'payment_intent_id', r.payment_intent_id), 'backfill');
    END IF;
  END LOOP;
  FOR r IN SELECT p.*, i.number AS invoice_number FROM public.marketplace_commercial_proposal_payments p
    LEFT JOIN public.marketplace_oppe_invoices i ON i.proposal_id = p.proposal_id WHERE p.paid_at IS NOT NULL ORDER BY p.paid_at LOOP
    PERFORM public.marketplace_journal_append('oppe', 'payment', 'payment:proposal_payment:' || r.proposal_id, 'proposal_payment', r.proposal_id,
      jsonb_build_object('proposal_id', r.proposal_id, 'method', 'carte', 'amount_cents', r.amount_paid_cents, 'currency', r.paid_currency,
        'paid_at', r.paid_at, 'payment_intent_id', r.stripe_payment_intent_id, 'invoice_number', r.invoice_number), 'backfill');
  END LOOP;
  FOR r IN SELECT * FROM public.marketplace_oppe_refunds WHERE status = 'succeeded' ORDER BY updated_at LOOP
    PERFORM public.marketplace_journal_append('oppe', 'refund', 'refund:oppe_refund:' || r.id, 'oppe_refund', r.id,
      jsonb_build_object('refund_id', r.id, 'invoice_id', r.invoice_id, 'method', 'carte', 'refund_cents', r.amount_cents,
        'currency', r.currency, 'stripe_refund_id', r.stripe_refund_id, 'credit_note_id', r.credit_note_id), 'backfill');
  END LOOP;
  FOR r IN
    SELECT 'binder_invoice' k, id, 'binder:' || binder_id AS issuer, pdf_path, pdf_sha256 FROM public.marketplace_binder_invoices WHERE pdf_sha256 IS NOT NULL
    UNION ALL SELECT 'binder_credit_note', id, 'binder:' || binder_id, pdf_path, pdf_sha256 FROM public.marketplace_binder_credit_notes WHERE pdf_sha256 IS NOT NULL
  LOOP
    PERFORM public.marketplace_journal_append(r.issuer, 'pdf_stored', 'pdf_stored:' || r.k || ':' || r.id, r.k, r.id,
      jsonb_build_object('document_kind', r.k, 'document_id', r.id, 'path', r.pdf_path, 'sha256', r.pdf_sha256), 'backfill');
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 12. Tâche planifiée : clôtures chaque nuit à 1 h 15 (heure de Paris en hiver), si pg_cron est installé.
--     Sans pg_cron, les clôtures sont rattrapées avant chaque vérification et chaque export.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    PERFORM cron.schedule('marketplace-journal-closures', '15 0 * * *', 'SELECT public.marketplace_journal_close_due()');
  ELSE
    RAISE NOTICE 'pg_cron absent : clôtures rattrapées à la vérification et à l''export';
  END IF;
END $$;
