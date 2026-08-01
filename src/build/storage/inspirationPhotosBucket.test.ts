// The bucket's limits live in two places that cannot import each other: a TS
// constant the engine validates against, and SQL that configures Postgres.
// Production and a from-scratch rebuild already disagreed once (the bucket was
// dashboard-created with no limits, while the migration declared them), so
// this test pins the two together.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  INSPIRATION_PHOTOS_ALLOWED_MIME_TYPES,
  INSPIRATION_PHOTOS_BUCKET,
  INSPIRATION_PHOTOS_MAX_FILE_SIZE_MB,
} from "./inspirationPhotosBucket";

const MIGRATIONS_DIR = join(process.cwd(), "supabase/migrations");

function allMigrationsSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .map((file) => readFileSync(join(MIGRATIONS_DIR, file), "utf8"))
    .join("\n");
}

describe("inspiration-photos bucket limits match the migrations", () => {
  it("declares the size limit in bytes that the constant describes in MB", () => {
    const expectedBytes = INSPIRATION_PHOTOS_MAX_FILE_SIZE_MB * 1024 * 1024;
    expect(allMigrationsSql()).toContain(`file_size_limit = ${expectedBytes}`);
  });

  it("declares exactly the allowed MIME types the constant lists", () => {
    const sql = allMigrationsSql();
    const expected = INSPIRATION_PHOTOS_ALLOWED_MIME_TYPES.map((type) => `'${type}'`).join(", ");
    expect(sql).toContain(`allowed_mime_types = ARRAY[${expected}]`);
  });

  it("converges an already-existing bucket, not just a freshly created one", () => {
    // CREATE ... ON CONFLICT DO NOTHING is a no-op against production, where
    // the bucket predates the migration. Without an UPDATE the two
    // environments stay different forever.
    const sql = allMigrationsSql();
    expect(sql).toContain("UPDATE storage.buckets");
    expect(sql).toContain(`WHERE id = '${INSPIRATION_PHOTOS_BUCKET}'`);
  });
});
