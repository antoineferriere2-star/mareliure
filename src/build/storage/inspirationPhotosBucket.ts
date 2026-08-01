/**
 * The infrastructure limits of the `build-inspiration-photos` Storage bucket,
 * declared once so the Playbook layer and the migration cannot drift apart.
 *
 * These are a hard ceiling enforced by Postgres/Storage itself. A Playbook can
 * ask for *less* (a stricter field is fine), but asking for more would pass the
 * app-side check in build-runtime.ts and then be rejected by Storage at upload
 * time — a runtime 500 for the visitor. getPlaybookPublishIssues refuses that
 * at publish time instead.
 *
 * Changing a value here means writing a migration that updates the bucket to
 * match; the two are asserted equal by inspirationPhotosBucket.test.ts.
 */
export const INSPIRATION_PHOTOS_BUCKET = "build-inspiration-photos";

export const INSPIRATION_PHOTOS_MAX_FILE_SIZE_MB = 8;

export const INSPIRATION_PHOTOS_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
