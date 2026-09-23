import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(fileURLToPath(new URL("../../supabase/migrations/20260923120000_marketplace_invoice_compliance.sql", import.meta.url)), "utf8");

describe("migration de conformité des factures", () => {
  it("conserve les pièces jusqu'à la fin de la dixième année", () => {
    expect(SQL.match(/date_trunc\('year', issue_date\) \+ interval '11 years - 1 day'/g)).toHaveLength(2);
    expect(SQL).toContain("date_trunc('year', p_issue_date) + interval '11 years - 1 day'");
    expect(SQL).not.toContain("interval '10 years 1 year - 1 day'");
  });

  it("préserve l'historique et ajoute un brouillon sans numéro", () => {
    expect(SQL).toContain("ALTER COLUMN invoice_number DROP NOT NULL");
    expect(SQL).toContain("status TEXT NOT NULL DEFAULT 'issued'");
    expect(SQL).toContain("status = 'draft' AND invoice_number IS NULL AND issued_at IS NULL");
    expect(SQL).toContain("marketplace_binder_create_invoice_draft");
    expect(SQL).not.toMatch(/DELETE FROM public\.marketplace_binder_invoices/);
  });

  it("attribue le numéro seulement à l'émission sous verrou", () => {
    const issue = SQL.slice(SQL.indexOf("FUNCTION public.marketplace_binder_issue_invoice"));
    expect(issue).toContain("FOR UPDATE");
    expect(issue).toContain("marketplace_binder_next_document_number");
    expect(issue.indexOf("marketplace_binder_next_document_number")).toBeLessThan(issue.indexOf("status = 'issued'"));
    expect(issue).toContain("IF v_invoice.status IN ('issued', 'credited') THEN RETURN v_invoice.id");
  });

  it("fige les pièces émises et interdit leur suppression", () => {
    expect(SQL).toContain("marketplace_binder_invoices content is immutable once issued");
    expect(SQL).toContain("BEFORE DELETE ON public.marketplace_binder_invoices");
    expect(SQL).toContain("issued invoices cannot be deleted");
    expect(SQL).toContain("BEFORE UPDATE OR DELETE ON public.marketplace_binder_invoice_items");
  });

  it("snapshotte les données réglementaires et réserve les champs électroniques", () => {
    for (const field of [
      "service_date", "due_date", "operation_nature", "client_type", "client_legal_name",
      "client_billing_address_line1", "client_siren", "client_vat_number",
      "client_purchase_order_number", "delivery_address_line1", "early_payment_discount_terms",
      "late_penalty_terms", "legal_mentions", "electronic_invoice_provider", "provider_invoice_id",
      "provider_status", "provider_sent_at", "structured_invoice_format", "reporting_status",
    ]) expect(SQL).toContain(field);
  });

  it("modélise l'avoir comme une pièce séparée et immuable", () => {
    expect(SQL).toContain("CREATE TABLE IF NOT EXISTS public.marketplace_binder_credit_notes");
    expect(SQL).toContain("marketplace_binder_create_full_credit_note");
    expect(SQL).toContain("credit notes are immutable");
    expect(SQL).toContain("kind, year, last_value");
    expect(SQL).toContain("UNIQUE (binder_id, credit_note_number)");
  });

  it("isole les nouvelles tables et fonctions du navigateur", () => {
    expect(SQL).toContain("ENABLE ROW LEVEL SECURITY");
    expect(SQL).toContain("FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)");
    expect(SQL).toContain("REVOKE ALL ON FUNCTION public.marketplace_binder_issue_invoice");
    expect(SQL).toContain("TO service_role");
  });
});
