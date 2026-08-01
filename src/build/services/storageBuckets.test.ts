// Every Storage bucket the app writes to must be created by a migration, not
// by hand in the Supabase dashboard.
//
// build-inspiration-photos was dashboard-created: only its deny-all RLS policy
// was ever committed, so a database rebuilt from migrations alone had a policy
// guarding a bucket that did not exist and every upload failed. This test
// fails the moment a new bucket is referenced in code without a matching
// migration.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(process.cwd(), "supabase/migrations");

/**
 * Every bucket name is declared once, in src/build/storage/. Scanning the
 * whole folder rather than a hardcoded file list means a new bucket is picked
 * up automatically — a list would silently stop covering the thing it was
 * written to cover.
 */
const BUCKET_CONSTANTS_DIR = join(process.cwd(), "src/build/storage");

function allMigrationsSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .map((file) => readFileSync(join(MIGRATIONS_DIR, file), "utf8"))
    .join("\n");
}

function referencedBuckets(): string[] {
  const names = new Set<string>();
  for (const file of readdirSync(BUCKET_CONSTANTS_DIR)) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
    const source = readFileSync(join(BUCKET_CONSTANTS_DIR, file), "utf8");
    for (const match of source.matchAll(/_BUCKET\s*=\s*"([a-z0-9-]+)"/g)) {
      names.add(match[1]);
    }
  }
  return [...names];
}

describe("Storage buckets are provisioned by migration", () => {
  it("finds at least one bucket reference to check", () => {
    // Guards the regex itself: a silently-empty list would make this file
    // pass forever while proving nothing.
    expect(referencedBuckets().length).toBeGreaterThan(0);
  });

  it("creates every referenced bucket in a migration", () => {
    const sql = allMigrationsSql();
    for (const bucket of referencedBuckets()) {
      expect(sql, `No migration creates the "${bucket}" bucket`).toContain("storage.buckets");
      expect(sql, `No migration inserts the "${bucket}" bucket id`).toContain(`'${bucket}'`);
    }
  });

  it("keeps the inspiration-photos bucket private (signed URLs only)", () => {
    const sql = allMigrationsSql();
    const insert = sql.slice(sql.indexOf("INSERT INTO storage.buckets"));
    expect(insert).toContain("build-inspiration-photos");
    expect(insert).toContain("FALSE");
  });
});
