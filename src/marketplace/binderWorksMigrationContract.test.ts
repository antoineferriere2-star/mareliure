// La migration Contacts + Ouvrages, lue comme un contrat sur le texte du SQL — même approche que
// binderQuotesMigrationContract.test.ts. Le comportement réel (numérotation, contraintes, triggers
// d'isolation entre ateliers, accès par rôle) a été rejoué sur un vrai Postgres (pglite) : voir le
// compte rendu de la PR.
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { QUOTE_ROW_KEYS } from "./quotes/quoteBuild";

const DIR = resolve(process.cwd(), "supabase/migrations");
const NAME = "20260921090000_marketplace_binder_contacts_works.sql";
const RAW = readFileSync(resolve(DIR, NAME), "utf8").replace(/\r\n/g, "\n");
// Le pied de fichier « retour arrière » est en commentaire : il ne compte pas comme du SQL exécuté.
const SQL = RAW.replace(/^\s*--.*$/gm, "").replace(/--.*$/gm, "");

const NEW_TABLES = [
  "marketplace_binder_work_counters",
  "marketplace_binder_works",
  "marketplace_binder_work_photos",
];

describe("migration Contacts + Ouvrages", () => {
  it("est additive : aucun DROP TABLE / DROP COLUMN / TRUNCATE / DELETE / UPDATE exécuté", () => {
    expect(SQL).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(SQL).not.toMatch(/\bDROP\s+COLUMN\b/i);
    expect(SQL).not.toMatch(/\bTRUNCATE\b/i);
    expect(SQL).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(SQL).not.toMatch(/^\s*UPDATE\s+public\./im);
    expect(SQL).not.toMatch(/\bALTER\s+COLUMN\b/i);
    expect(SQL).not.toMatch(/\bRENAME\b/i);
  });

  it("ne DROP que ses propres contraintes, déclencheurs et politiques", () => {
    const drops = [...SQL.matchAll(/\bDROP\s+(\w+)(?:\s+IF\s+EXISTS)?\s+("[^"]+"|[\w.]+)/gi)].map((m) => `${m[1].toUpperCase()} ${m[2]}`);
    for (const drop of drops) {
      expect(drop, drop).toMatch(/^(CONSTRAINT marketplace_binder_(clients_origin|works_|work_photos_)|TRIGGER marketplace_binder_(works_|quotes_work_)|POLICY "No direct access to marketplace_binder_work)/);
    }
  });

  it("n'altère que marketplace_binder_clients, marketplace_binder_quotes (une colonne) et ses propres tables", () => {
    const altered = [...SQL.matchAll(/\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?public\.(\w+)/gi)].map((m) => m[1]);
    for (const table of new Set(altered)) {
      expect([...NEW_TABLES, "marketplace_binder_works", "marketplace_binder_clients", "marketplace_binder_quotes"], table).toContain(table);
    }
    // Aucune facture, aucun poste de facture, aucun compteur de documents, aucun profil : intacts.
    for (const untouched of ["marketplace_binder_invoices", "marketplace_binder_invoice_items", "marketplace_binder_document_counters", "marketplace_binder_billing_profiles"]) {
      expect(SQL, untouched).not.toContain(untouched);
    }
    const quotesAlter = SQL.match(/ALTER TABLE public\.marketplace_binder_quotes\s+([^;]*);/i)![1];
    expect(quotesAlter).toMatch(/^ADD COLUMN IF NOT EXISTS work_id UUID REFERENCES public\.marketplace_binder_works\(id\) ON DELETE SET NULL$/);
  });

  it("ne touche ni la fonction de conversion en facture ni le déclencheur d'immutabilité (Phase 0)", () => {
    expect(SQL).not.toMatch(/marketplace_binder_convert_quote_to_invoice/);
    expect(SQL).not.toMatch(/immutab/i);
    expect(SQL).not.toMatch(/marketplace_binder_create_quote|marketplace_binder_update_quote/);
  });

  it("ajoute au client ses colonnes sans en changer aucune : nullable, ou défaut", () => {
    const alter = SQL.match(/ALTER TABLE public\.marketplace_binder_clients\s+ADD COLUMN([^;]*);/i)![1];
    for (const column of ["first_name", "last_name", "organization", "origin", "origin_case_id", "archived_at"]) {
      expect(alter, column).toContain(`IF NOT EXISTS ${column} `);
    }
    expect(alter).toMatch(/origin TEXT NOT NULL DEFAULT 'mon_client'/);
    // Une seule colonne NOT NULL — et elle a un défaut : les fiches existantes restent valides.
    expect((alter.match(/NOT NULL/g) ?? []).length).toBe(1);
  });

  it("l'origine est bornée, et un contact ne référence un dossier que s'il vient de Ma Reliure", () => {
    expect(SQL).toMatch(/CHECK \(origin IN \('mon_client', 'ma_reliure'\) AND \(origin_case_id IS NULL OR origin = 'ma_reliure'\)\)/);
  });

  it("l'ouvrage porte tous les champs voulus, et l'atelier est obligatoire", () => {
    const start = SQL.indexOf("CREATE TABLE IF NOT EXISTS public.marketplace_binder_works (");
    const body = SQL.slice(start).split("\n);")[0];
    for (const column of [
      "binder_id UUID NOT NULL", "contact_id UUID", "reference TEXT NOT NULL", "title TEXT NOT NULL", "author TEXT",
      "edition_note TEXT", "description TEXT", "height_mm INTEGER", "width_mm INTEGER", "thickness_mm INTEGER",
      "weight_grams INTEGER", "declared_value_cents INTEGER", "condition_notes TEXT", "internal_notes TEXT",
      "status TEXT NOT NULL DEFAULT 'active'", "source TEXT NOT NULL DEFAULT 'mon_client'", "case_id UUID UNIQUE",
      "created_at TIMESTAMPTZ NOT NULL", "updated_at TIMESTAMPTZ NOT NULL", "UNIQUE (binder_id, reference)",
    ]) {
      expect(body, column).toContain(column);
    }
    // Un atelier ne perd pas ses ouvrages en cascade ; un contact supprimé ne détruit pas l'ouvrage.
    expect(body).toMatch(/binder_id UUID NOT NULL REFERENCES public\.marketplace_binders\(id\) ON DELETE RESTRICT/);
    expect(body).toMatch(/contact_id UUID REFERENCES public\.marketplace_binder_clients\(id\) ON DELETE SET NULL/);
  });

  it("source, statut, dimensions, poids et valeur sont bornés par la base", () => {
    expect(SQL).toMatch(/CHECK \(status IN \('active', 'archived'\)\)/);
    expect(SQL).toMatch(/CHECK \(source IN \('mon_client', 'ma_reliure'\) AND \(case_id IS NULL OR source = 'ma_reliure'\)\)/);
    expect(SQL).toMatch(/height_mm BETWEEN 1 AND 2000/);
    expect(SQL).toMatch(/width_mm BETWEEN 1 AND 2000/);
    expect(SQL).toMatch(/thickness_mm BETWEEN 1 AND 2000/);
    expect(SQL).toMatch(/weight_grams BETWEEN 1 AND 50000/);
    expect(SQL).toMatch(/declared_value_cents BETWEEN 0 AND/);
  });

  it("les photos : cinq étapes exactement, rattachées à l'ouvrage — la structure sans UX", () => {
    expect(SQL).toMatch(/CHECK \(stage IN \('intake', 'before', 'reception', 'during', 'after'\)\)/);
    const start = SQL.indexOf("CREATE TABLE IF NOT EXISTS public.marketplace_binder_work_photos (");
    const body = SQL.slice(start).split("\n);")[0];
    expect(body).toContain("work_id UUID NOT NULL REFERENCES public.marketplace_binder_works(id) ON DELETE CASCADE");
    expect(body).toContain("binder_id UUID NOT NULL");
    expect(SQL).not.toMatch(/storage\.buckets|INSERT INTO storage/i); // aucun bucket dans cette PR
  });

  it("le lien devis → ouvrage est nullable et ne quitte pas l'atelier (déclencheurs de la base)", () => {
    expect(SQL).toContain("ADD COLUMN IF NOT EXISTS work_id UUID REFERENCES public.marketplace_binder_works(id) ON DELETE SET NULL");
    expect(SQL).toMatch(/AND w\.binder_id = NEW\.binder_id/);
    expect(SQL).toMatch(/BEFORE INSERT OR UPDATE OF work_id ON public\.marketplace_binder_quotes/);
    expect(SQL).toMatch(/AND c\.binder_id = NEW\.binder_id/);
    expect(SQL).toMatch(/BEFORE INSERT OR UPDATE OF contact_id, binder_id ON public\.marketplace_binder_works/);
  });

  it("la création impose atelier, référence, statut, source et dossier — le navigateur n'y peut rien", () => {
    const fn = SQL.slice(SQL.indexOf("FUNCTION public.marketplace_binder_create_work("));
    const merged = fn.slice(fn.indexOf("p_work || jsonb_build_object("), fn.indexOf("AS r;"));
    for (const forced of ["'binder_id', p_binder_id", "'reference', v_ref", "'status', 'active'", "'source', 'mon_client'", "'case_id', NULL", "'id', v_id"]) {
      expect(merged, forced).toContain(forced);
    }
    // Le côté droit de `||` l'emporte : les clés forcées sont bien APRÈS le JSON du client.
    expect(merged.indexOf("p_work")).toBeLessThan(merged.indexOf("'binder_id'"));
  });

  it.each(NEW_TABLES)("%s : RLS activée, refus total pour anon et authenticated, service_role seul", (table) => {
    expect(SQL).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    expect(SQL).toMatch(new RegExp(`CREATE POLICY "No direct access to ${table}"\\s+ON public\\.${table} FOR ALL TO anon, authenticated\\s+USING \\(false\\) WITH CHECK \\(false\\);`));
    expect(SQL).toContain(`GRANT ALL ON public.${table} TO service_role;`);
    expect(SQL).not.toMatch(new RegExp(`GRANT[^;]*ON public\\.${table} TO[^;]*\\b(anon|authenticated|PUBLIC)\\b`, "i"));
  });

  it("les fonctions ne sont pas exposées : REVOKE PUBLIC/anon/authenticated, GRANT service_role", () => {
    for (const signature of ["marketplace_binder_next_work_reference(UUID, INTEGER)", "marketplace_binder_create_work(UUID, JSONB)"]) {
      expect(SQL).toContain(`REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated;`);
      expect(SQL).toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO service_role;`);
    }
    for (const trigger of ["marketplace_binder_works_same_binder()", "marketplace_binder_quotes_work_same_binder()"]) {
      expect(SQL).toContain(`REVOKE ALL ON FUNCTION public.${trigger} FROM PUBLIC, anon, authenticated;`);
    }
    // Aucune fonction ne s'exécute avec les droits de son propriétaire.
    expect(SQL).not.toMatch(/SECURITY\s+DEFINER/i);
  });

  it("`work_id` reste HORS de la ligne de devis validée : le devis envoie sa propre clé, ou aucune", () => {
    expect(QUOTE_ROW_KEYS as readonly string[]).not.toContain("work_id");
  });

  it("le pied de fichier documente le retour arrière", () => {
    expect(RAW).toMatch(/Retour arrière/);
    expect(RAW).toMatch(/DROP COLUMN IF EXISTS work_id/);
  });
});

describe("l'historique des migrations", () => {
  it("la migration s'applique APRÈS celle du devis (elle en étend les tables) ; d'autres peuvent lui succéder", () => {
    const names = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
    expect(names).toContain("20260919090000_marketplace_binder_quotes.sql");
    expect(names.indexOf(NAME)).toBeGreaterThan(names.indexOf("20260919090000_marketplace_binder_quotes.sql"));
    expect(names.indexOf(NAME)).toBeGreaterThan(names.indexOf("20260920130000_marketplace_message_audiences.sql"));
  });

  it("aucune migration antérieure ne mentionne les objets créés ici (rien d'appliqué n'a été réécrit)", () => {
    for (const file of readdirSync(DIR).filter((f) => f.endsWith(".sql") && f !== NAME)) {
      const text = readFileSync(resolve(DIR, file), "utf8");
      expect(text, file).not.toMatch(/marketplace_binder_works\b|marketplace_binder_work_photos|marketplace_binder_work_counters|binder_create_work/);
    }
  });
});
