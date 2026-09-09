// The marketplace migration, read as a contract.
//
// There is no database in this test environment, so these assertions are on the
// SQL text — the same approach `storageBuckets.test.ts` and `teamContract.test.ts`
// already take in this repo. They will not catch a syntax error Postgres would,
// and they are not meant to: they catch the changes a reviewer would object to
// and a running database would happily accept. A table added without RLS. A
// foreign key with no ON DELETE. A CHECK constraint that has drifted from the
// TypeScript enum it mirrors. A policy quietly loosened on a build_* table.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DECLARED_VALUE_BANDS } from "./cases/caseProfile";
import { CLAIM_METHODS } from "./cases/ownership";

import { MAX_BINDERS_PER_CASE } from "./config";

/**
 * Les états qu'un devis pouvait prendre dans le premier modèle.
 *
 * Ils vivaient dans `quotes/rules.ts`, supprimé avec ce modèle. Ils restent
 * ici parce que ce fichier vérifie une migration déjà appliquée, dont les
 * contraintes sont de l'histoire : un fichier de migration ne se réécrit pas,
 * et son contrat doit continuer de décrire ce qu'il a réellement posé.
 */
const QUOTE_STATES = ["submitted", "selected", "rejected", "expired", "withdrawn"] as const;

const SQL = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260908120000_marketplace_reliure.sql"),
  "utf8",
).replace(/\r\n/g, "\n");

const LEGACY_CASE_STATUSES = [
  "under_review",
  "matching",
  "sent_to_binders",
  "quotes_received",
  "binder_selected",
  "awaiting_payment",
  "paid",
  "shipping_to_binder",
  "received_by_binder",
  "in_progress",
  "awaiting_approval",
  "shipping_to_customer",
  "delivered",
  "completed",
  "cancelled",
] as const;

/** The SQL with comments stripped — comments say the right things; statements must too. */
const STATEMENTS = SQL.replace(/^\s*--.*$/gm, "").replace(/--.*$/gm, "");

const MARKETPLACE_TABLES = [
  "marketplace_intake_missions",
  "marketplace_binders",
  "marketplace_binder_skills",
  "marketplace_binder_portfolio",
  "marketplace_cases",
  "marketplace_case_matches",
  "marketplace_quotes",
];

describe("every marketplace table is isolated exactly like build_*", () => {
  it.each(MARKETPLACE_TABLES)("%s is created", (table) => {
    expect(STATEMENTS).toContain(`CREATE TABLE public.${table} (`);
  });

  it.each(MARKETPLACE_TABLES)("%s grants only service_role", (table) => {
    expect(STATEMENTS).toContain(`GRANT ALL ON public.${table} TO service_role;`);
    // No grant to a client-reachable role, ever. That is what makes the server
    // functions the only door.
    expect(STATEMENTS).not.toContain(`ON public.${table} TO authenticated`);
    expect(STATEMENTS).not.toContain(`ON public.${table} TO anon`);
  });

  it.each(MARKETPLACE_TABLES)("%s enables RLS and denies anon + authenticated", (table) => {
    expect(STATEMENTS).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    const policy = STATEMENTS.slice(
      STATEMENTS.indexOf(`CREATE POLICY "No direct access to ${table}"`),
    ).slice(0, 220);
    expect(policy).toContain("FOR ALL TO anon, authenticated");
    expect(policy).toContain("USING (false) WITH CHECK (false)");
  });
});

describe("the migration does not touch Métré's own tables", () => {
  it("alters no build_* table", () => {
    expect(STATEMENTS).not.toMatch(/ALTER TABLE\s+(IF EXISTS\s+)?(public\.)?build_/i);
  });

  it("creates, drops or alters no policy on a build_* table", () => {
    expect(STATEMENTS).not.toMatch(/POLICY[\s\S]{0,120}ON\s+public\.build_/i);
  });

  it("touches build_dossiers only to add its own ingestion trigger", () => {
    // `\b` matters: without it this also matches the tail of
    // "EXECUTE FUNCTION public.build_touch_updated_at", which is Métré's shared
    // timestamp helper being reused — not a modification of anything.
    const buildReferences = [...STATEMENTS.matchAll(/\bON public\.build_\w+/g)].map((m) => m[0]);
    expect(new Set(buildReferences)).toEqual(new Set(["ON public.build_dossiers"]));
    expect(STATEMENTS).toContain(
      "CREATE TRIGGER build_dossiers_marketplace_ingest\n  AFTER INSERT ON public.build_dossiers",
    );
  });

  it("drops nothing that belongs to Métré", () => {
    const drops = [...STATEMENTS.matchAll(/DROP\s+\w+\s+(IF EXISTS\s+)?[\w."]+/gi)].map(
      (m) => m[0],
    );
    for (const drop of drops) {
      expect(drop, `unexpected drop: ${drop}`).not.toMatch(/build_/);
    }
  });
});

describe("foreign keys all say what happens on delete", () => {
  it("leaves no REFERENCES without an ON DELETE", () => {
    // A missing ON DELETE defaults to NO ACTION, which turns an ordinary
    // deletion elsewhere into an error nobody expects. Every reference here is
    // a deliberate choice, so every one is written down.
    const references = [...STATEMENTS.matchAll(/REFERENCES[^,\n]*/g)].map((m) => m[0]);
    expect(references.length).toBeGreaterThan(5);
    for (const reference of references) {
      expect(reference, `no ON DELETE: ${reference}`).toMatch(/ON DELETE/);
    }
  });

  it("cascades a case away with its Dossier, and never leaves it orphaned", () => {
    expect(STATEMENTS).toContain(
      "dossier_id UUID NOT NULL UNIQUE REFERENCES public.build_dossiers(id) ON DELETE CASCADE",
    );
  });

  it("keeps a case when the account that owns it is deleted", () => {
    expect(STATEMENTS).toContain(
      "customer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL",
    );
    // ...and the claim CHECK must tolerate that, or deleting a user would fail.
    expect(STATEMENTS).toContain(
      "customer_user_id IS NULL OR (claimed_at IS NOT NULL AND claim_method IS NOT NULL)",
    );
  });
});

describe("CHECK constraints mirror the TypeScript vocabularies", () => {
  /**
   * Values listed inside the named constraint's own IN (...) clause.
   *
   * Bounded at the next CONSTRAINT keyword: a fixed-width window spills into
   * the following constraint's values and quietly makes every one of these
   * assertions pass against the union of all of them.
   */
  function constrainedValues(constraint: string): string[] {
    const start = STATEMENTS.indexOf(`CONSTRAINT ${constraint} CHECK`);
    expect(start, `missing constraint ${constraint}`).toBeGreaterThan(-1);
    const rest = STATEMENTS.slice(start + `CONSTRAINT ${constraint} CHECK`.length);
    const next = rest.indexOf("CONSTRAINT ");
    const clause = next === -1 ? rest : rest.slice(0, next);
    return [...clause.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
  }

  it("pins the statuses introduced by the first marketplace migration", () => {
    expect(new Set(constrainedValues("marketplace_cases_status_check"))).toEqual(
      new Set(LEGACY_CASE_STATUSES),
    );
  });

  it("declared value bands match DECLARED_VALUE_BANDS", () => {
    expect(new Set(constrainedValues("marketplace_cases_value_band_check"))).toEqual(
      new Set(DECLARED_VALUE_BANDS),
    );
  });

  it("claim methods match CLAIM_METHODS", () => {
    expect(new Set(constrainedValues("marketplace_cases_claim_method_check"))).toEqual(
      new Set(CLAIM_METHODS),
    );
  });

  it("quote states match QUOTE_STATES, plus the draft the DB allows", () => {
    expect(new Set(constrainedValues("marketplace_quotes_state_check"))).toEqual(
      new Set([...QUOTE_STATES, "draft"]),
    );
  });

  it("refuses a quote that is free, negative or instant", () => {
    expect(STATEMENTS).toContain("CHECK (amount_cents > 0)");
    expect(STATEMENTS).toContain("CHECK (lead_time_weeks > 0)");
  });
});

describe("the ingestion trigger", () => {
  const body = STATEMENTS.slice(
    STATEMENTS.indexOf("CREATE OR REPLACE FUNCTION public.marketplace_ingest_dossier()"),
    STATEMENTS.indexOf("CREATE TRIGGER build_dossiers_marketplace_ingest"),
  );

  it("ignores a Mission that is not enrolled", () => {
    expect(body).toContain("FROM public.marketplace_intake_missions m WHERE m.mission_id");
    expect(body).toContain("RETURN NEW;");
  });

  it("is idempotent through the UNIQUE on dossier_id", () => {
    expect(body).toContain("ON CONFLICT (dossier_id) DO NOTHING");
    expect(STATEMENTS).toContain("dossier_id UUID NOT NULL UNIQUE");
  });

  it("can never fail the visitor's submission", () => {
    // It runs inside the transaction that inserts the Dossier. Anything it
    // raises would roll back a submission the visitor already completed.
    expect(body).toContain("EXCEPTION WHEN OTHERS THEN");
  });

  it("has a repair path for the cases it silently skipped", () => {
    expect(STATEMENTS).toContain(
      "CREATE OR REPLACE FUNCTION public.marketplace_ingest_missing_cases()",
    );
    const repair = STATEMENTS.slice(
      STATEMENTS.indexOf("CREATE OR REPLACE FUNCTION public.marketplace_ingest_missing_cases()"),
    ).slice(0, 1400);
    expect(repair).toContain("JOIN public.marketplace_intake_missions");
    expect(repair).toContain("WHERE NOT EXISTS");
    expect(repair).toContain("ON CONFLICT (dossier_id) DO NOTHING");
  });
});

describe("the three-relieur ceiling holds at the database level", () => {
  it("fires AFTER insert, so it sees its own statement's rows", () => {
    // A BEFORE ROW trigger cannot see the other rows of its own statement, so
    // one INSERT of four rows would pass every check. This is the difference
    // between a guarantee and a comment claiming one.
    expect(STATEMENTS).toContain(
      "CREATE TRIGGER marketplace_case_matches_ceiling\n  AFTER INSERT ON public.marketplace_case_matches",
    );
    expect(STATEMENTS).toContain("IF existing > 3 THEN");
  });

  it("uses the same number the application does", () => {
    expect(MAX_BINDERS_PER_CASE).toBe(3);
    expect(STATEMENTS).toContain("at most 3 relieurs");
  });

  it("allows at most one selected relieur and one selected quote", () => {
    expect(STATEMENTS).toContain("marketplace_case_matches_one_selected_uidx");
    expect(STATEMENTS).toContain("marketplace_quotes_one_selected_uidx");
  });
});

describe("no customer PII is copied into the marketplace schema", () => {
  it("stores no customer contact column", () => {
    // The customer's name, e-mail, phone and address stay on build_dossiers and
    // are reached only through dossierProjection.ts, which decides per viewer
    // whether to include them.
    //
    // Column names, not raw text: the claim_method CHECK legitimately contains
    // the literal 'verified_email', and a substring search reads that as a
    // stored address.
    const caseTable = STATEMENTS.slice(
      STATEMENTS.indexOf("CREATE TABLE public.marketplace_cases ("),
      STATEMENTS.indexOf("GRANT ALL ON public.marketplace_cases"),
    );
    const columns = caseTable
      .split("\n")
      .map((line) => /^\s{2}([a-z_]+)\s+[A-Z]/.exec(line)?.[1])
      .filter((name): name is string => Boolean(name));

    expect(columns).toContain("dossier_id");
    for (const forbidden of ["email", "phone", "visitor_name", "street", "address"]) {
      for (const column of columns) {
        expect(column, `marketplace_cases must not store ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("copies no answer, brief or summary column", () => {
    for (const forbidden of ["answers", "content", "visitor_summary", "next_questions"]) {
      expect(STATEMENTS, `marketplace must not copy ${forbidden}`).not.toContain(
        `${forbidden} JSONB`,
      );
    }
  });
});

describe("the migration can be undone", () => {
  it("documents a rollback for every object it creates", () => {
    const rollback = SQL.slice(SQL.indexOf("-- Rollback"));
    for (const table of MARKETPLACE_TABLES) {
      expect(rollback, `rollback misses ${table}`).toContain(
        `DROP TABLE IF EXISTS public.${table}`,
      );
    }
    expect(rollback).toContain("DROP TRIGGER IF EXISTS build_dossiers_marketplace_ingest");
    expect(rollback).toContain("DROP FUNCTION IF EXISTS public.marketplace_ingest_dossier()");
    expect(rollback).toContain("DROP FUNCTION IF EXISTS public.marketplace_ingest_missing_cases()");
    expect(rollback).toContain(
      "DROP FUNCTION IF EXISTS public.marketplace_enforce_match_ceiling()",
    );
    expect(rollback).toContain("DROP SEQUENCE IF EXISTS public.marketplace_case_reference_seq");
  });
});

describe("function permissions", () => {
  it("exposes the reconciliation function to service_role only", () => {
    expect(STATEMENTS).toContain(
      "REVOKE ALL ON FUNCTION public.marketplace_ingest_missing_cases() FROM PUBLIC, anon, authenticated;",
    );
    expect(STATEMENTS).toContain(
      "GRANT EXECUTE ON FUNCTION public.marketplace_ingest_missing_cases() TO service_role;",
    );
  });

  it("revokes PUBLIC from the SECURITY DEFINER trigger functions too", () => {
    expect(STATEMENTS).toContain(
      "REVOKE ALL ON FUNCTION public.marketplace_ingest_dossier() FROM PUBLIC, anon, authenticated;",
    );
  });

  it("pins search_path on every SECURITY DEFINER function", () => {
    const definers = STATEMENTS.split("SECURITY DEFINER").slice(1);
    expect(definers.length).toBe(3);
    for (const body of definers) {
      expect(body.slice(0, 60)).toContain("SET search_path = public");
    }
  });
});
