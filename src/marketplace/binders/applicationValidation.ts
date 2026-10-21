import { z } from "zod";
import { LEGAL_ENTITY_TYPES, REVENUE_BANDS } from "./application";
import { isKnownBinderSkill } from "./skills";

export const APPLICATION_LIMITS = {
  firstName: 100,
  lastName: 100,
  workshopName: 200,
  city: 100,
  email: 200,
  phone: 30,
  websiteUrl: 300,
  message: 2000,
  hpCompanyName: 200,
} as const;

const text = (label: string, max: number) =>
  z
    .string({ required_error: `Renseignez ${label}.` })
    .trim()
    .max(max, `${label} : ${max} caractères maximum.`);
const requiredText = (label: string, max: number) =>
  text(label, max).min(1, `Renseignez ${label}.`);
const optionalText = (label: string, max: number) => text(label, max).optional();

const applicationInput = z.object({
  firstName: requiredText("votre prénom", APPLICATION_LIMITS.firstName),
  lastName: requiredText("votre nom", APPLICATION_LIMITS.lastName),
  workshopName: requiredText("le nom de votre atelier", APPLICATION_LIMITS.workshopName),
  email: text("votre adresse e-mail", APPLICATION_LIMITS.email).email(
    "Saisissez une adresse e-mail valide, par exemple nom@atelier.fr.",
  ),
  phone: optionalText("Téléphone", APPLICATION_LIMITS.phone).refine((value) => {
    if (!value) return true;
    return /^\+?[\d\s().-]+$/.test(value) && /^\d{7,15}$/.test(value.replace(/\D/g, ""));
  }, "Saisissez un téléphone de 7 à 15 chiffres, avec un indicatif si nécessaire (+33, +49…). Espaces, points, tirets et parenthèses sont acceptés."),
  city: optionalText("Ville", APPLICATION_LIMITS.city),
  websiteUrl: optionalText("Site ou réseau social", APPLICATION_LIMITS.websiteUrl).refine(
    (value) => {
      if (!value) return true;
      if (!/^https?:\/\//i.test(value)) return false;
      try {
        return ["http:", "https:"].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    },
    "Saisissez une adresse complète commençant par https:// ou http://.",
  ),
  legalEntityType: z.enum(LEGAL_ENTITY_TYPES).optional(),
  skills: z
    .array(z.string())
    .max(20, "Sélectionnez au maximum 20 savoir-faire.")
    .optional()
    .transform((values) => (values ?? []).filter(isKnownBinderSkill)),
  yearsExperience: z
    .number({ invalid_type_error: "Saisissez un nombre entier d'années entre 0 et 100." })
    .int("Saisissez un nombre entier d'années entre 0 et 100.")
    .min(0, "Saisissez un nombre d'années entre 0 et 100.")
    .max(100, "Saisissez un nombre d'années entre 0 et 100.")
    .optional(),
  averageAnnualRevenueBand: z.enum(REVENUE_BANDS).optional(),
  message: optionalText("Présentation de votre atelier", APPLICATION_LIMITS.message),
  consent: z.literal(true, {
    errorMap: () => ({
      message: "Acceptez l'utilisation de ces informations pour l'étude de votre candidature.",
    }),
  }),
  hpCompanyName: z.string().max(APPLICATION_LIMITS.hpCompanyName).optional(),
});

export type ApplicationField = keyof z.input<typeof applicationInput>;
export type ApplicationFieldErrors = Partial<Record<ApplicationField | "_form", string>>;

/** Résultat sérialisable identique côté navigateur et serveur, sans exposer les détails de Zod. */
export function validateBinderApplication(input: unknown) {
  const parsed = applicationInput.safeParse(input);
  if (parsed.success) return { ok: true as const, data: parsed.data };
  const fieldErrors: ApplicationFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as ApplicationField | undefined;
    const key = field && field !== "hpCompanyName" ? field : "_form";
    fieldErrors[key] ??=
      key === "_form" ? "Vérifiez les informations de votre candidature." : issue.message;
  }
  return { ok: false as const, fieldErrors };
}
