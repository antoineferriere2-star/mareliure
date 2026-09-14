/**
 * Qui édite Ma Reliure, et à qui écrire.
 *
 * Source unique des faits juridiques affichés sur le site : les mentions
 * légales, la politique de confidentialité, les conditions d'utilisation et
 * chaque lien de contact les lisent ici. Une adresse ou un numéro qui change ne
 * doit se corriger qu'à un endroit.
 *
 * Tout ce qui figure dans ce fichier a été fourni par l'éditeur le
 * 10 septembre 2026. Rien n'y est déduit. Ce qui n'a pas été fourni — le nom du
 * directeur de la publication — n'y figure pas, et les pages le désignent par
 * sa fonction plutôt que par un nom supposé.
 */

export const MARELIURE_PUBLISHER = {
  name: "OPPE SAS",
  legalForm: "Société par actions simplifiée (SAS)",
  /** La même forme, telle qu'elle s'écrit au milieu d'une phrase. */
  legalFormInSentence: "société par actions simplifiée (SAS)",
  capital: "100,00 €",
  address: "705 route du Montclair, 24160 Clermont-d'Excideuil",
  siren: "943 317 610",
  siret: "943 317 610 00013",
  rcs: "RCS Périgueux 943 317 610",
  vat: "FR55 943 317 610",
} as const;

/**
 * L'adresse publiée pour toute demande : contact, relieurs, données
 * personnelles. Choisie par l'éditeur.
 *
 * Elle remplace `contact@mareliure.fr`, introduite sur la page d'accueil sans
 * que personne ait vérifié que la boîte existait.
 */
export const MARELIURE_CONTACT_EMAIL = "contact@oppe.fr";

/**
 * Les prestataires réellement utilisés, tels que le code les révèle. Un test
 * confronte ces valeurs aux fichiers qui les emploient : si l'expéditeur des
 * e-mails change dans le code, la politique de confidentialité doit changer
 * avec lui.
 *
 * `email` a longtemps affirmé "Lovable" / notify.metre-pro.fr — exact pour
 * Métré Build, faux pour Ma Reliure depuis que send-email.ts envoie via
 * Resend (MARELIURE_FROM, "noreply@mareliure.fr") pour toute marque
 * `isMaReliure`. Le test qui devait l'attraper vérifiait seulement qu'une
 * chaîne de caractères apparaissait quelque part dans le fichier — vraie par
 * coïncidence, jamais sur le bon embranchement. Corrigé ici et dans
 * legal.test.ts.
 */
export const MARELIURE_PROVIDERS = {
  webHost: {
    name: "Cloudflare, Inc.",
    address: "101 Townsend Street, San Francisco, CA 94107, États-Unis",
  },
  dataHost: { name: "Supabase, Inc.", region: "Union européenne (Irlande)" },
  email: { name: "Resend", senderDomain: "mareliure.fr" },
  ai: { name: "Lovable AI Gateway" },
} as const;

/** Durée de validité du lien vers le récapitulatif, en jours. */
export const SUMMARY_LINK_VALIDITY_DAYS = 90;

/** La date affichée en tête des pages légales, au format ISO. À changer à chaque révision. */
export const LEGAL_PAGES_UPDATED_AT = "2026-09-10";

/** Formate {@link LEGAL_PAGES_UPDATED_AT} dans la langue de la page qui l'affiche. */
export function formatLegalPagesUpdatedAt(locale: "fr-FR" | "en-US"): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${LEGAL_PAGES_UPDATED_AT}T00:00:00Z`),
  );
}
