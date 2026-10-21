import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { undeclaredTables } from "../../src/marketplace/security/tableGrants";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec("CREATE ROLE authenticated;CREATE SCHEMA audit;");
});
afterAll(async () => {
  await db.close();
});
// Non-regressions of the five residual #154 probes corrected by #160.
const probes = [
  {
    name: "fixed #160: WITH SELECT INTO is not followed",
    sql: "WITH payload AS (SELECT 1 AS id) SELECT * INTO public.build_notes FROM payload;",
    target: "public.build_notes",
  },
  {
    name: "fixed #160: a temporary CREATE hides a persistent CREATE in the same DO body",
    sql: "DO $$ BEGIN CREATE TEMP TABLE scratch(id int); CREATE TABLE public.build_notes(id int); END $$;",
    target: "public.build_notes",
  },
  {
    name: "fixed #160: a quoted identifier collides with the lexer's qid0 token",
    sql: 'CREATE TABLE public.qid0(id int);CREATE TABLE public."other_notes"(id int);GRANT SELECT ON public."other_notes" TO authenticated;',
    target: "public.qid0",
  },
  {
    name: "fixed #160: dotted schema and table names share the same internal key",
    sql: 'CREATE SCHEMA "public.case";CREATE TABLE public."case.notes"(id int);CREATE TABLE "public.case".notes(id int);GRANT SELECT ON "public.case".notes TO authenticated;',
    target: 'public."case.notes"',
  },
  {
    name: "fixed #160: an escaped CREATE token in dynamic SQL is not decoded",
    sql: "DO $$ BEGIN EXECUTE E'\\x43REATE TABLE public.build_notes(id int)'; END $$;",
    target: "public.build_notes",
  },
];
describe("corrected #154 residual probes after #160", () => {
  for (const probe of probes)
    it(probe.name, async () => {
      expect(undeclaredTables(probe.sql)).not.toEqual([]);
      await db.exec("BEGIN;");
      try {
        await db.exec(probe.sql);
        const r = await db.query<{ allowed: boolean }>(
          "SELECT has_table_privilege('authenticated',$1,'SELECT') allowed",
          [probe.target],
        );
        expect(r.rows[0].allowed).toBe(false);
      } finally {
        await db.exec("ROLLBACK;");
      }
    });
  it("the intentionally reviewed dynamic marker remains a deliberate accepted exception", async () => {
    const sql =
      "-- acl: dynamic-reviewed\nDO $$ BEGIN CREATE TABLE public.reviewed_notes(id int); END $$;";
    expect(undeclaredTables(sql)).toEqual([]);
    expect(
      undeclaredTables(sql.replace("-- acl: dynamic-reviewed", "-- not reviewed")),
    ).not.toEqual([]);
  });
});
