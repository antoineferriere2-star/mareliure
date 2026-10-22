-- Retour arrière de l'étape 2 (migration 20261024100000) : journal chaîné, clôtures, conservation.
--
-- À n'appliquer qu'avec le retour du Worker à la version précédente.
-- Aucune donnée n'est supprimée : le journal, ses entrées, les colonnes PDF des pièces OPPE et les PDF
-- rangés restent en place (le journal reste en ajout seul) ; seuls les déclencheurs qui l'alimentent,
-- la tâche planifiée et l'exception « PDF une fois » des pièces OPPE sont retirés.
-- Les clés étrangères passées en RESTRICT le restent : revenir à CASCADE rouvrirait la suppression de pièces.
--
-- Testé sur une copie PGlite (src/marketplace/invoices/einvoicingPhase2Journal.migration.test.ts).

BEGIN;

DROP TRIGGER IF EXISTS marketplace_journal_binder_invoice_issued ON public.marketplace_binder_invoices;
DROP TRIGGER IF EXISTS marketplace_journal_binder_invoice_pdf ON public.marketplace_binder_invoices;
DROP TRIGGER IF EXISTS marketplace_journal_binder_credit_note_issued ON public.marketplace_binder_credit_notes;
DROP TRIGGER IF EXISTS marketplace_journal_binder_credit_note_pdf ON public.marketplace_binder_credit_notes;
DROP TRIGGER IF EXISTS marketplace_journal_settlement ON public.marketplace_external_settlements;
DROP TRIGGER IF EXISTS marketplace_journal_online_payment_paid ON public.marketplace_workshop_online_payments;
DROP TRIGGER IF EXISTS marketplace_journal_online_payment_refund ON public.marketplace_workshop_online_payments;
DROP TRIGGER IF EXISTS marketplace_journal_supplier_invoice ON public.marketplace_oppe_supplier_invoices;
DROP TRIGGER IF EXISTS marketplace_journal_supplier_payment ON public.marketplace_oppe_supplier_payments;
DROP TRIGGER IF EXISTS marketplace_journal_oppe_invoice ON public.marketplace_oppe_invoices;
DROP TRIGGER IF EXISTS marketplace_journal_oppe_invoice_pdf ON public.marketplace_oppe_invoices;
DROP TRIGGER IF EXISTS marketplace_journal_oppe_credit_note ON public.marketplace_oppe_credit_notes;
DROP TRIGGER IF EXISTS marketplace_journal_oppe_credit_note_pdf ON public.marketplace_oppe_credit_notes;
DROP TRIGGER IF EXISTS marketplace_journal_proposal_payment_insert ON public.marketplace_commercial_proposal_payments;
DROP TRIGGER IF EXISTS marketplace_journal_proposal_payment_update ON public.marketplace_commercial_proposal_payments;
DROP TRIGGER IF EXISTS marketplace_journal_oppe_refund_insert ON public.marketplace_oppe_refunds;
DROP TRIGGER IF EXISTS marketplace_journal_oppe_refund_update ON public.marketplace_oppe_refunds;
DROP TRIGGER IF EXISTS marketplace_journal_prefix_change ON public.marketplace_binder_billing_profiles;

-- Pièces OPPE : immuabilité d'origine, sans exception (20261005150000).
CREATE OR REPLACE FUNCTION public.marketplace_forbid_oppe_document_change() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'oppe_document_immutable'; END $$;
REVOKE UPDATE (pdf_path, pdf_sha256) ON public.marketplace_oppe_invoices, public.marketplace_oppe_credit_notes FROM service_role;

-- Tâche planifiée.
DO $$
BEGIN
  -- Requête dynamique : sans pg_cron, le schéma cron n'existe pas et ne doit pas être compilé.
  IF to_regnamespace('cron') IS NOT NULL THEN
    EXECUTE 'SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = ''marketplace-journal-closures''';
  END IF;
END $$;

-- Fonctions ouvertes au serveur : retirées (le journal reste lisible par le propriétaire).
REVOKE EXECUTE ON FUNCTION public.marketplace_journal_verify(text), public.marketplace_journal_close_due(text),
  public.marketplace_journal_record_event(text, text, jsonb, uuid) FROM service_role;

COMMIT;
