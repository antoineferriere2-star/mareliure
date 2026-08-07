/**
 * The infrastructure limits of the `build-project-photos` Storage bucket —
 * the files a visitor attaches to a `photo` field ("photos or plans"), as
 * opposed to the single inspiration image the vision agent reads.
 *
 * They are kept apart deliberately. Inspiration photos exist to be analysed
 * and are read by an AI agent; these are evidence attached to a project and
 * are only ever read by the workspace. Same shape of ceiling as
 * inspirationPhotosBucket.ts, and the same rule: a Playbook may ask for less,
 * never more, and getPlaybookPublishIssues refuses a field that asks for more
 * rather than letting Storage reject the upload in front of the visitor.
 *
 * Changing a value here means writing a migration that updates the bucket to
 * match; projectPhotosBucket.test.ts asserts the two agree.
 */
export const PROJECT_PHOTOS_BUCKET = "build-project-photos";

export const PROJECT_PHOTOS_MAX_FILE_SIZE_MB = 8;

export const PROJECT_PHOTOS_MAX_FILES = 12;

/**
 * HEIC is here because iPhones produce it by default and the deck Playbook has
 * been advertising "JPG, PNG, WEBP or HEIC" to visitors all along. Browsers
 * are inconsistent about which of the two type strings they report, so both
 * are allowed.
 */
export const PROJECT_PHOTOS_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;
