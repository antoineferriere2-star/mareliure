import { BINDER_SKILLS } from "./skills";

export const PUBLIC_PROFILE_STATUSES = ["draft", "published"] as const;
export type PublicProfileStatus = (typeof PUBLIC_PROFILE_STATUSES)[number];

export const PROFILE_REQUEST_SOURCE = "finebindery_profile" as const;
export const PROFILE_SOURCE_ANSWER_KEY = "_request_source";
export const FINE_BINDERY_SUBMISSION_LOCALE_KEY = "_submission_locale";
export const FINE_BINDERY_PREFERRED_LANGUAGE_KEY = "_preferred_language";

export const PUBLIC_LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "Anglais" },
  { code: "de", label: "Allemand" },
  { code: "it", label: "Italien" },
  { code: "es", label: "Espagnol" },
] as const;

/** Sélection courte de techniques issues de reliure-fr-v1, identifiées par leur clé stable. */
export const PUBLIC_TECHNIQUES = [
  { key: "OPR-0027", label: "Couture de cahiers" },
  { key: "OPR-0035", label: "Couture de conservation" },
  { key: "OPR-0074", label: "Parure du cuir" },
  { key: "OPR-0109", label: "Dorure directe sur cuir" },
  { key: "OPR-0114", label: "Dorure manuelle" },
  { key: "OPR-0126", label: "Mosaïque incrustée" },
  { key: "OPR-0136", label: "Consolidation du cuir" },
  { key: "OPR-0151", label: "Consolidation du papier" },
] as const;

/** Les trois choix de matière du référentiel reliure-fr-v1. */
export const PUBLIC_MATERIALS = [
  { key: "OPR-0193", label: "Cuir" },
  { key: "OPR-0194", label: "Papier décoré" },
  { key: "OPR-0195", label: "Toile" },
] as const;

export const PUBLIC_SPECIALTY_KEYS = BINDER_SKILLS.map((skill) => skill.slug);
export const PUBLIC_LANGUAGE_CODES = PUBLIC_LANGUAGES.map((language) => language.code);
export const PUBLIC_TECHNIQUE_KEYS = PUBLIC_TECHNIQUES.map((technique) => technique.key);
export const PUBLIC_MATERIAL_KEYS = PUBLIC_MATERIALS.map((material) => material.key);

export interface PublicProfileReadinessInput {
  workshopName: string | null;
  city: string | null;
  bio: string | null;
  skills: readonly string[];
}

export function publicProfileMissing(input: PublicProfileReadinessInput): string[] {
  const missing: string[] = [];
  if (!input.workshopName?.trim()) missing.push("nom de l’atelier");
  if (!input.city?.trim()) missing.push("ville");
  if (!input.bio?.trim()) missing.push("présentation");
  if (input.skills.length === 0) missing.push("au moins une spécialité");
  return missing;
}

export function canPublishPublicProfile(input: PublicProfileReadinessInput): boolean {
  return publicProfileMissing(input).length === 0;
}

export function fineBinderyProfilePath(slug: string): string {
  return `/en/${slug}`;
}

export function sourceLabel(origin: string): string {
  if (origin === "FINEBINDERY_PROFILE") return "Page FineBindery";
  if (origin === "BINDER_REFERRED") return "Mon atelier";
  return "Ma Reliure";
}
