import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { undeclaredTables } from "../../src/marketplace/security/tableGrants";
const probes = JSON.parse(
  readFileSync(new URL("./probes160.json", import.meta.url), "utf8"),
) as Array<{
  name: string;
  sql: string;
  target: string;
  expectedDetector: string[];
  expectedSelect: boolean;
  kind: string;
}>;
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec("CREATE ROLE authenticated;CREATE SCHEMA audit;");
});
afterAll(async () => {
  await db.close();
});
describe("independent #160 SQL review: PostgreSQL execution, not regex-only examples", () => {
  for (const p of probes)
    it(p.kind + ": " + p.name, async () => {
      expect(undeclaredTables(p.sql)).toEqual(p.expectedDetector);
      await db.exec("BEGIN;");
      try {
        await db.exec(p.sql);
        const result = await db.query<{ exists: boolean; allowed: boolean }>(
          "SELECT to_regclass($1) IS NOT NULL AS exists, has_table_privilege('authenticated',$1,'SELECT') allowed",
          [p.target],
        );
        expect(result.rows[0]).toEqual({ exists: true, allowed: p.expectedSelect });
      } finally {
        await db.exec("ROLLBACK;");
      }
    });
});
