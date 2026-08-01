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

/** Bucket-name constants declared in app code, as `const NAME = "bucket-id"`. */
const BUCKET_CONSTANT_SOURCES = [
  "src/routes/api/public/build-runtime.ts",
  "src/build/services/admin.data.functions.ts",
  "src/routes/api/public/project-summary.ts",
];

function allMigrationsSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .map((file) => readFileSync(join(MIGRATIONS_DIR, file), "utf8"))
    .join("\n");
}

function referencedBuckets(): string[] {
  const names = new Set<string>();
  for (const relativePath of BUCKET_CONSTANT_SOURCES) {
    const source = readFileSync(join(process.cwd(), relativePath), "utf8");
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
