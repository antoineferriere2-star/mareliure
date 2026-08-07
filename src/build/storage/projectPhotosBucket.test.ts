// Same reasoning as inspirationPhotosBucket.test.ts: the ceiling exists twice,
// once as a TS constant the engine validates against and once as SQL that
// configures Postgres, and the two cannot import each other. When they drift,
// a Playbook passes the app-side check and Storage rejects the upload in the
// visitor's face.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PROJECT_PHOTOS_ALLOWED_MIME_TYPES,
  PROJECT_PHOTOS_BUCKET,
  PROJECT_PHOTOS_MAX_FILE_SIZE_MB,
} from "./projectPhotosBucket";

const MIGRATIONS_DIR = join(process.cwd(), "supabase/migrations");

function allMigrationsSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .map((file) => readFileSync(join(MIGRATIONS_DIR, file), "utf8"))
    .join("\n");
}

describe("project-photos bucket limits match the migrations", () => {
  it("creates the bucket the constant names", () => {
    expect(allMigrationsSql()).toContain(`'${PROJECT_PHOTOS_BUCKET}'`);
  });

  it("declares the size limit in bytes that the constant describes in MB", () => {
    const expectedBytes = PROJECT_PHOTOS_MAX_FILE_SIZE_MB * 1024 * 1024;
    expect(allMigrationsSql()).toContain(`${expectedBytes}, -- 8 MB per file`);
  });

  it("declares exactly the allowed MIME types the constant lists", () => {
    const expected = PROJECT_PHOTOS_ALLOWED_MIME_TYPES.map((type) => `'${type}'`).join(", ");
    expect(allMigrationsSql()).toContain(`ARRAY[${expected}]`);
  });

  it("converges an existing bucket instead of skipping it", () => {
    // ON CONFLICT DO NOTHING would leave a bucket created by hand — or by an
    // earlier version of this migration — permanently out of step.
    expect(allMigrationsSql()).toContain("ON CONFLICT (id) DO UPDATE");
  });

  it("stays unreachable from the browser", () => {
    // Uploads go through the runtime handler with the service-role key; reads
    // go through a signed URL. Neither anon nor authenticated may touch it.
    const sql = allMigrationsSql();
    expect(sql).toContain(`No direct access to ${PROJECT_PHOTOS_BUCKET}`);
    expect(sql).toContain(`bucket_id = '${PROJECT_PHOTOS_BUCKET}' AND FALSE`);
  });
});
