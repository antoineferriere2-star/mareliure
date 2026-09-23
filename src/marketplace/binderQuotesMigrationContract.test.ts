// La migration de l'outil devis → facture, lue comme un contrat — même approche que
// binderMembershipMigrationContract.test.ts : sur le texte du SQL, faute de base de
// données dans cet environnement. Le comportement réel (numérotation, atomicité,
// immuabilité, isolation par rôle) est vérifié sur un vrai Postgres à part.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { QUOTE_ITEM_ROW_KEYS, QUOTE_ROW_KEYS } from "./quotes/quoteBuild";

const RAW = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260919090000_marketplace_binder_quotes.sql"),
  "utf8",
).replace(/\r\n/g, "\n");
const SQL = RAW.replace(/^\s*--.*$/gm, "").replace(/--.*$/gm, "");
const BLOCKS_SQL = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260923100000_marketplace_quote_size_blocks_photos.sql"),
  "utf8",
).replace(/^\s*--.*$/gm, "").replace(/--.*$/gm, "");

const TABLES = [
  "marketplace_binder_billing_profiles",
  "marketplace_binder_service_categories",
  "marketplace_binder_services",
  "marketplace_binder_clients",
  "marketplace_binder_document_counters",
  "marketplace_binder_quotes",
  "marketplace_binder_quote_items",
  "marketplace_binder_invoices",
  "marketplace_binder_invoice_items",
];

const FUNCTIONS: [string, string][] = [
  ["marketplace_binder_next_document_number", "UUID, TEXT, INTEGER"],
  ["marketplace_binder_create_quote", "UUID, JSONB, JSONB"],
  ["marketplace_binder_update_quote", "UUID, UUID, JSONB, JSONB"],
  ["marketplace_binder_convert_quote_to_invoice", "UUID, UUID, DATE, TEXT, JSONB"],
];

/** Les colonnes d'une table : nom → { notNull, hasDefault }. */
function columns(table: string): Map<string, { notNull: boolean; hasDefault: boolean }> {
  const start = SQL.indexOf(`CREATE TABLE IF NOT EXISTS public.${table} (`);
  expect(start, table).toBeGreaterThan(-1);
  const body = SQL.slice(start).split("\n);")[0].split("\n").slice(1);
  const result = new Map<string, { notNull: boolean; hasDefault: boolean }>();
  for (const line of body) {
    const m = line.match(/^ {2}([a-z_0-9]+) [A-Z]/);
    if (!m || ["UNIQUE", "PRIMARY", "CONSTRAINT"].includes(m[1].toUpperCase())) continue;
    result.set(m[1], { notNull: /NOT NULL|PRIMARY KEY/.test(line), hasDefault: /DEFAULT/.test(line) });
  }
  return result;
}

describe("isolation : comme toutes les tables marketplace_*", () => {
  it.each(TABLES)("%s est créée, service_role seulement, RLS activée, anon et authenticated refusés", (table) => {
    expect(SQL).toContain(`CREATE TABLE IF NOT EXISTS public.${table} (`);
    expect(SQL).toContain(`GRANT ALL ON public.${table} TO service_role;`);
    expect(SQL).not.toMatch(new RegExp(`ON public\\.${table} TO (authenticated|anon|PUBLIC)`));
    expect(SQL).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    const policy = SQL.slice(SQL.indexOf(`CREATE POLICY "No direct access to ${table}"`)).slice(0, 260);
    expect(policy).toContain("FOR ALL TO anon, authenticated");
    expect(policy).toContain("USING (false) WITH CHECK (false)");
  });

  it.each(FUNCTIONS)("la fonction %s n'est exécutable que par service_role", (name, args) => {
    expect(SQL).toContain(`REVOKE ALL ON FUNCTION public.${name}(${args}) FROM PUBLIC, anon, authenticated;`);
    expect(SQL).toContain(`GRANT EXECUTE ON FUNCTION public.${name}(${args}) TO service_role;`);
    expect(SQL).not.toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}[^;]*TO (authenticated|anon|PUBLIC)`));
  });

  it("aucune politique n'ouvre quoi que ce soit à anon ou authenticated", () => {
    expect(SQL).not.toMatch(/CREATE POLICY[^;]*USING \(true\)/);
    expect(SQL).not.toMatch(/CREATE POLICY[^;]*TO (authenticated|anon)[^,]/);
    // Toutes les politiques de ce fichier sont des « deny » : autant de politiques que de tables.
    expect((SQL.match(/CREATE POLICY/g) ?? []).length).toBe(TABLES.length);
  });
});

describe("additive : aucune table existante n'est touchée", () => {
  it("ne modifie que les tables qu'elle crée, et ne supprime rien hors du rollback commenté", () => {
    for (const m of SQL.matchAll(/ALTER TABLE public\.([a-z_]+)/g)) expect(TABLES).toContain(m[1]);
    expect(SQL).not.toMatch(/DROP TABLE/i);
    expect(SQL).not.toMatch(/DROP COLUMN/i);
    expect(SQL).not.toMatch(/TRUNCATE|DELETE FROM public\.marketplace_(cases|binders|commercial)/i);
    expect(RAW).toContain("-- DROP TABLE IF EXISTS public.marketplace_binder_billing_profiles;");
  });
});

describe("intégrité", () => {
  it("un atelier ne peut pas être supprimé sous ses devis et factures (pièces à conserver)", () => {
    for (const table of ["marketplace_binder_quotes", "marketplace_binder_invoices"]) {
      const block = SQL.slice(SQL.indexOf(`CREATE TABLE IF NOT EXISTS public.${table} (`)).split("\n);")[0];
      expect(block).toMatch(/binder_id UUID NOT NULL REFERENCES public\.marketplace_binders\(id\) ON DELETE RESTRICT/);
    }
  });

  it("numéros uniques par atelier ; un devis ne donne qu'une facture, qu'on ne supprime pas", () => {
    expect(SQL).toContain("UNIQUE (binder_id, quote_number)");
    expect(SQL).toContain("UNIQUE (binder_id, invoice_number)");
    expect(SQL).toMatch(/quote_id UUID NOT NULL UNIQUE REFERENCES public\.marketplace_binder_quotes\(id\) ON DELETE RESTRICT/);
  });

  it("un devis conserve son snapshot : supprimer un client ou une prestation ne le casse pas", () => {
    expect(SQL).toMatch(/client_id UUID REFERENCES public\.marketplace_binder_clients\(id\) ON DELETE SET NULL/);
    expect(SQL).toMatch(/service_id UUID REFERENCES public\.marketplace_binder_services\(id\) ON DELETE SET NULL/);
  });

  it("aucun régime de TVA n'est présumé : la colonne est nullable, sans défaut", () => {
    expect(columns("marketplace_binder_billing_profiles").get("vat_regime")).toEqual({ notNull: false, hasDefault: false });
    expect(SQL).toContain("vat_regime IS NULL OR vat_regime IN ('FRANCHISE', 'VAT_LIABLE')");
  });

  it("la numérotation est atomique : un UPSERT sur le compteur, dans la transaction de l'écriture", () => {
    expect(SQL).toContain("ON CONFLICT (binder_id, kind, year) DO UPDATE SET last_value = c.last_value + 1");
    expect(SQL).toContain("marketplace_binder_next_document_number(");
    // Le numéro de facture est attribué dans la fonction qui écrit la facture et ses lignes.
    const convert = SQL.slice(SQL.indexOf("FUNCTION public.marketplace_binder_convert_quote_to_invoice"));
    expect(convert).toContain("FOR UPDATE");
    expect(convert).toContain("marketplace_binder_next_document_number(");
    expect(convert.indexOf("INSERT INTO public.marketplace_binder_invoice_items")).toBeGreaterThan(
      convert.indexOf("marketplace_binder_next_document_number("),
    );
  });

  it("l'acompte, le solde et le suivi de paiement existent sur la facture", () => {
    const cols = columns("marketplace_binder_invoices");
    for (const name of ["deposit_cents", "deposit_paid_cents", "amount_paid_cents", "payment_status", "paid_at"]) {
      expect(cols.has(name), name).toBe(true);
    }
    expect(SQL).toContain("CHECK (payment_status IN ('unpaid', 'deposit_paid', 'paid'))");
  });
});

describe("une facture émise ne se modifie plus", () => {
  it("un trigger interdit toute modification du contenu ; seuls paiement et emplacements externes restent libres", () => {
    expect(SQL).toContain("marketplace_binder_invoices_immutable");
    expect(SQL).toContain("BEFORE UPDATE ON public.marketplace_binder_invoices");
    const mutable = SQL.slice(SQL.indexOf("v_mutable TEXT[] := ARRAY[")).split("];")[0];
    const names = [...mutable.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(names).toEqual(
      [
        "updated_at", "deposit_paid_cents", "amount_paid_cents", "payment_status", "paid_at",
        "external_provider", "external_invoice_id", "external_status",
        "electronic_invoice_status", "electronic_invoice_sent_at", "external_metadata",
      ].sort(),
    );
    for (const protectedColumn of ["invoice_number", "total_ttc_cents", "total_ht_cents", "client_name", "issuer", "quote_id", "deposit_cents"]) {
      expect(names).not.toContain(protectedColumn);
    }
  });

  it("les lignes de facture ne se modifient ni ne se suppriment", () => {
    expect(SQL).toContain("BEFORE UPDATE OR DELETE ON public.marketplace_binder_invoice_items");
  });

  it("les emplacements d'une future Plateforme Agréée existent, nullables, sans fournisseur figé", () => {
    const cols = columns("marketplace_binder_invoices");
    for (const name of [
      "external_provider", "external_invoice_id", "external_status",
      "electronic_invoice_status", "electronic_invoice_sent_at", "external_metadata",
    ]) {
      expect(cols.get(name), name).toEqual({ notNull: false, hasDefault: false });
    }
    expect(SQL).not.toMatch(/weproc|weinvoice|b2brouter|tiime|pennylane|chorus/i);
    expect(SQL).not.toMatch(/external_provider[^,\n]*CHECK|external_provider IN/i);
  });
});

describe("le serveur envoie exactement ce que la base attend", () => {
  it("chaque clé d'un devis est une colonne, et toute colonne obligatoire est fournie ou attribuée par la fonction", () => {
    const cols = columns("marketplace_binder_quotes");
    for (const key of QUOTE_ROW_KEYS) expect(cols.has(key), key).toBe(true);
    const setByFunction = new Set(["id", "binder_id", "quote_number", "status", "created_at", "updated_at"]);
    for (const [name, meta] of cols) {
      if (meta.notNull && !meta.hasDefault) {
        expect(QUOTE_ROW_KEYS.includes(name as never) || setByFunction.has(name), name).toBe(true);
      }
      if (meta.notNull) {
        // Les colonnes obligatoires AVEC défaut (currency, discount_type, …) sont envoyées quand même :
        // jsonb_populate_record ne pose jamais un défaut de colonne.
        expect(QUOTE_ROW_KEYS.includes(name as never) || setByFunction.has(name), name).toBe(true);
      }
    }
  });

  it("de même pour les lignes de devis", () => {
    const cols = columns("marketplace_binder_quote_items");
    for (const key of QUOTE_ITEM_ROW_KEYS) {
      expect(cols.has(key) || BLOCKS_SQL.includes(`ADD COLUMN IF NOT EXISTS ${key} `), key).toBe(true);
    }
    const setByFunction = new Set(["id", "quote_id", "binder_id", "position"]);
    for (const [name, meta] of cols) {
      if (meta.notNull) expect(QUOTE_ITEM_ROW_KEYS.includes(name as never) || setByFunction.has(name), name).toBe(true);
    }
  });

  it("les montants ne sont jamais des flottants en base : centimes entiers, taux en points de base", () => {
    for (const table of ["marketplace_binder_quotes", "marketplace_binder_invoices", "marketplace_binder_quote_items", "marketplace_binder_invoice_items"]) {
      const block = SQL.slice(SQL.indexOf(`CREATE TABLE IF NOT EXISTS public.${table} (`)).split("\n);")[0];
      expect(block).not.toMatch(/\b(FLOAT|REAL|DOUBLE PRECISION|MONEY)\b/i);
      for (const m of block.matchAll(/ {2}([a-z_]+_cents) ([A-Z]+)/g)) expect(m[2], m[1]).toBe("INTEGER");
    }
  });
});
