/**
 * The skills a relieur can declare, and how they read to a customer.
 *
 * Stored as rows in `marketplace_binder_skills` keyed by slug, never as a
 * database enum: adding "reliure japonaise" must be a seed line, not a
 * migration (§29). This list is the catalogue the admin UI offers — a slug
 * absent from it still stores and still matches, it simply has no French label
 * yet.
 */

export interface BinderSkill {
  slug: string;
  label: string;
  /** One sentence a customer who knows nothing about bookbinding can read. */
  description: string;
}

export const BINDER_SKILLS: readonly BinderSkill[] = [
  {
    slug: "reliure_toile",
    label: "Reliure toile",
    description: "Couvertures en toile : sobre, solide, la solution la plus courante.",
  },
  {
    slug: "papier_decore",
    label: "Papier décoré",
    description: "Papiers marbrés, à la cuve ou imprimés, posés sur les plats.",
  },
  {
    slug: "demi_cuir",
    label: "Demi-cuir",
    description: "Dos et coins en cuir, plats en papier ou en toile.",
  },
  {
    slug: "plein_cuir",
    label: "Plein cuir",
    description: "Couvrure intégrale en cuir, le travail le plus exigeant.",
  },
  {
    slug: "dorure",
    label: "Dorure",
    description: "Titrage et décors posés à l'or, au fer ou à la roulette.",
  },
  {
    slug: "restauration",
    label: "Restauration",
    description: "Rendre à un ouvrage abîmé un état proche de son état d'origine.",
  },
  {
    slug: "conservation",
    label: "Conservation",
    description: "Stabiliser un ouvrage fragile sans le transformer.",
  },
  {
    slug: "cartonnage",
    label: "Cartonnage",
    description: "Boîtes, étuis et emboîtages sur mesure.",
  },
  {
    slug: "rebinding_contemporain",
    label: "Rebinding contemporain",
    description: "Reliures actuelles : matières et lignes d'aujourd'hui.",
  },
  {
    slug: "reliure_art",
    label: "Reliure d'art",
    description: "Créations originales conçues pour un ouvrage en particulier.",
  },
];

const BY_SLUG = new Map(BINDER_SKILLS.map((skill) => [skill.slug, skill]));

/** The catalogue entry, or a readable fallback for a slug seeded outside it. */
export function binderSkillLabel(slug: string): string {
  return BY_SLUG.get(slug)?.label ?? slug.replace(/_/g, " ");
}

export function isKnownBinderSkill(slug: string): boolean {
  return BY_SLUG.has(slug);
}
