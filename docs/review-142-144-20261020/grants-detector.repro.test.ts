import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { undeclaredTables } from "../../src/marketplace/security/newTableGrants.test";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec("CREATE ROLE authenticated;");
});
afterAll(async () => {
  await db.close();
});
const cases = [
  {
    name: "typed CREATE TABLE without column list",
    sql: "CREATE TYPE public.qa_note AS (id int); CREATE TABLE public.build_notes OF public.qa_note;",
    detected: [],
    read: false,
  },
  {
    name: "CREATE TABLE AS",
    sql: "CREATE TABLE public.build_notes AS SELECT 1 AS id;",
    detected: [],
    read: false,
  },
  {
    name: "UNLOGGED",
    sql: "CREATE UNLOGGED TABLE public.build_notes(id int);",
    detected: [],
    read: false,
  },
  {
    name: "quoted schema",
    sql: 'CREATE TABLE "public".build_notes(id int);',
    detected: [],
    read: false,
  },
  {
    name: "quoted schema and table",
    sql: 'CREATE TABLE "public"."build_notes"(id int);',
    detected: [],
    read: false,
  },
  {
    name: "block comment masquerading as grant",
    sql: "CREATE TABLE public.build_notes(id int); /* GRANT SELECT ON public.build_notes TO authenticated; */",
    detected: [],
    read: false,
  },
  {
    name: "SQL string masquerading as grant",
    sql: "CREATE TABLE public.build_notes(id int); SELECT 'GRANT SELECT ON public.build_notes TO authenticated;';",
    detected: [],
    read: false,
  },
  {
    name: "grant to a suffix-matching other table",
    sql: "CREATE TABLE public.other_build_notes(id int); GRANT SELECT ON public.other_build_notes TO authenticated; CREATE TABLE public.build_notes(id int);",
    detected: [],
    read: false,
  },
  {
    name: "rename after explicit grant preserves ACL",
    sql: "CREATE TABLE public.build_old(id int); GRANT SELECT ON public.build_old TO authenticated; ALTER TABLE public.build_old RENAME TO build_notes;",
    detected: [],
    read: true,
  },
  {
    name: "grant after rename is wrongly rejected",
    sql: "CREATE TABLE public.build_old(id int); ALTER TABLE public.build_old RENAME TO build_notes; GRANT SELECT ON public.build_notes TO authenticated;",
    detected: ["build_old"],
    read: true,
  },
  {
    name: "partition without column list",
    sql: "CREATE TABLE public.qa_partition_root(id int) PARTITION BY RANGE(id); GRANT SELECT ON public.qa_partition_root TO authenticated; CREATE TABLE public.build_notes PARTITION OF public.qa_partition_root FOR VALUES FROM(0) TO(10);",
    detected: [],
    read: false,
  },
];
describe("independent review of guard 144 — characterisations, not correction assertions", () => {
  for (const c of cases)
    it(c.name, async () => {
      expect(undeclaredTables(c.sql)).toEqual(c.detected);
      await db.exec("BEGIN;");
      try {
        await db.exec(c.sql);
        const r = await db.query<{ allowed: boolean }>(
          "SELECT has_table_privilege('authenticated','public.build_notes','SELECT') allowed",
        );
        expect(r.rows[0].allowed).toBe(c.read);
      } finally {
        await db.exec("ROLLBACK;");
      }
    });
  it("bare CREATE TABLE name with no definition is invalid SQL, not a valid bypass", async () => {
    await expect(db.exec("CREATE TABLE public.bare_invalid;")).rejects.toThrow(/syntax error/);
  });
  it("bare invalid creation followed by rename is also rejected by PostgreSQL", async () => {
    await expect(
      db.exec(
        "CREATE TABLE public.bare_invalid; ALTER TABLE public.bare_invalid RENAME TO build_notes;",
      ),
    ).rejects.toThrow(/syntax error/);
  });
});
