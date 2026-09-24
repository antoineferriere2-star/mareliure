export const REFERRAL_ANSWER_KEY = "_referral_slug";
export const PROFILE_REQUEST_SOURCE = "finebindery_profile" as const;
export const PROFILE_SOURCE_ANSWER_KEY = "_request_source";
export const FINE_BINDERY_SUBMISSION_LOCALE_KEY = "_submission_locale";
export const FINE_BINDERY_PREFERRED_LANGUAGE_KEY = "_preferred_language";

const FINE_BINDERY_LOCALES = new Set(["en", "fr", "de", "it", "es"]);
const REFERRAL_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Returns undefined for a regular Playbook answer, null for valid runtime
 * metadata, and a message for invalid metadata.
 */
export function runtimeSessionMetadataError(key: string, value: unknown): string | null | undefined {
  if (key === REFERRAL_ANSWER_KEY) {
    return typeof value === "string" && value.length >= 3 && value.length <= 64 && REFERRAL_SLUG.test(value)
      ? null
      : "Invalid referral slug.";
  }
  if (key === PROFILE_SOURCE_ANSWER_KEY) {
    return value === PROFILE_REQUEST_SOURCE ? null : "Invalid request source.";
  }
  if (key === FINE_BINDERY_SUBMISSION_LOCALE_KEY || key === FINE_BINDERY_PREFERRED_LANGUAGE_KEY) {
    return typeof value === "string" && FINE_BINDERY_LOCALES.has(value)
      ? null
      : "Invalid FineBindery locale.";
  }
  return undefined;
}
