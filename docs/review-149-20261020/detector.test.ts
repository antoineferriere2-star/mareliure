import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { undeclaredTables } from "../../src/marketplace/security/tableGrants";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "CREATE ROLE authenticated;CREATE SCHEMA audit;CREATE TABLE public.qa_source(id int); GRANT SELECT ON public.qa_source TO authenticated; CREATE TABLE public.case_notes(id int);",
  );
});
afterAll(async () => {
  await db.close();
});
// Non-regressions after #154: these assertions require the corrected guard.
const cases = [
  {
    name: "single-quoted dynamic DO requires explicit review",
    sql: "DO 'BEGIN EXECUTE format(''CREATE TABLE %I.%I(id int)'', ''public'', ''build_notes''); END';",
    missing: ["<création dynamique (EXECUTE, DO, format) à déclarer>"],
    target: "public.build_notes",
    read: false,
  },
  {
    name: "SET SCHEMA public requires a decision for the imported relation",
    sql: "CREATE TABLE audit.build_notes(id int);ALTER TABLE audit.build_notes SET SCHEMA public;",
    missing: ["build_notes"],
    target: "public.build_notes",
    read: false,
  },
  {
    name: "LIKE is detected and does not inherit source ACL",
    sql: "CREATE TABLE public.build_notes (LIKE public.qa_source INCLUDING ALL);",
    missing: ["build_notes"],
    target: "public.build_notes",
    read: false,
  },
  {
    name: "wildcard GRANT before a new table is insufficient and detected",
    sql: "GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;CREATE TABLE public.build_notes(id int);",
    missing: ["build_notes"],
    target: "public.build_notes",
    read: false,
  },
  {
    name: "wildcard GRANT after creation covers the new table",
    sql: "CREATE TABLE public.build_notes(id int);GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;",
    missing: [],
    target: "public.build_notes",
    read: true,
  },
  {
    name: "quoted uppercase table cannot borrow the lowercase relation grant",
    sql: 'CREATE TABLE public."CASE_NOTES"(id int);GRANT SELECT ON public.case_notes TO authenticated;',
    missing: ["CASE_NOTES"],
    target: 'public."CASE_NOTES"',
    read: false,
  },
  {
    name: "quoted uppercase name with its exact grant is valid",
    sql: 'CREATE TABLE public."CASE_NOTES"(id int);GRANT SELECT ON public."CASE_NOTES" TO authenticated;',
    missing: [],
    target: 'public."CASE_NOTES"',
    read: true,
  },
  {
    name: "Unicode creation reports the exact relation name",
    sql: 'CREATE TABLE public."Étiquettes"(id int);',
    missing: ["Étiquettes"],
    target: 'public."Étiquettes"',
    read: false,
  },
  {
    name: "exact Unicode grant is accepted",
    sql: 'CREATE TABLE public."Étiquettes"(id int);GRANT SELECT ON public."Étiquettes" TO authenticated;',
    missing: [],
    target: 'public."Étiquettes"',
    read: true,
  },
  {
    name: "rename then SET SCHEMA keeps the undecided relation",
    sql: "CREATE TABLE audit.before_name(id int);ALTER TABLE audit.before_name RENAME TO build_notes;ALTER TABLE audit.build_notes SET SCHEMA public;",
    missing: ["build_notes"],
    target: "public.build_notes",
    read: false,
  },
  {
    name: "fragmented dynamic SQL requires explicit review",
    sql: "DO $$ BEGIN EXECUTE format('%s %s public.%I(id int)', 'CREATE', 'TABLE', 'build_notes'); END $$;",
    missing: ["<création dynamique (EXECUTE, DO, format) à déclarer>"],
    target: "public.build_notes",
    read: false,
  },
];
describe("non-regressions of #152 corrected by #154", () => {
  for (const c of cases)
    it(c.name, async () => {
      expect(undeclaredTables(c.sql)).toEqual(c.missing);
      await db.exec("BEGIN;");
      try {
        await db.exec(c.sql);
        const r = await db.query<{ allowed: boolean }>(
          "SELECT has_table_privilege('authenticated',$1,'SELECT') allowed",
          [c.target],
        );
        expect(r.rows[0].allowed).toBe(c.read);
      } finally {
        await db.exec("ROLLBACK;");
      }
    });
  it("rename alone in another schema stays outside public, so is not a bypass", async () => {
    const sql =
      "CREATE TABLE audit.before_name(id int);ALTER TABLE audit.before_name RENAME TO build_notes;";
    expect(undeclaredTables(sql)).toEqual([]);
    await db.exec("BEGIN;");
    try {
      await db.exec(sql);
      const r = await db.query<{ inside: string | null; outside: string | null }>(
        "SELECT to_regclass('public.build_notes')::text inside,to_regclass('audit.build_notes')::text outside",
      );
      expect(r.rows[0].inside).toBeNull();
      expect(r.rows[0].outside).toBe("audit.build_notes");
    } finally {
      await db.exec("ROLLBACK;");
    }
  });
  it("bare EXECUTE format is not top-level dynamic SQL and cannot count as a valid bypass", async () => {
    await expect(
      db.exec("EXECUTE format('CREATE TABLE public.build_notes(id int)');"),
    ).rejects.toThrow();
  });
});
