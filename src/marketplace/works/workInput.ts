/**
 * Ce que le navigateur a le droit d'envoyer pour un contact ou un ouvrage — et rien d'autre.
 *
 * Jamais l'atelier (la session le donne), jamais la référence de l'ouvrage (le serveur la
 * numérote), jamais la source ni le dossier d'origine (un ouvrage saisi ici est toujours
 * « mon client »), jamais l'origine d'un contact. Les schémas sont `.strict()` : un champ en
 * plus est refusé, pas ignoré.
 *
 * Les dimensions sont en millimètres entiers (l'unité des devis), le poids en grammes, la
 * valeur déclarée en centimes.
 */
import { z } from "zod";
import { contactDisplayName, LOOSE_EMAIL } from "./contactName";

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));
const uuid = z.string().uuid();
const mm = z.number().int().min(1).max(2000).nullable();

export const contactInput = z
  .object({
    id: uuid.nullable(),
    firstName: optionalText(100),
    lastName: optionalText(100),
    organization: optionalText(200),
    email: optionalText(200).refine((v) => v === null || LOOSE_EMAIL.test(v), "Adresse e-mail invalide"),
    phone: optionalText(40),
    addressLine1: optionalText(300),
    postalCode: optionalText(20),
    city: optionalText(120),
    country: optionalText(80),
    notes: optionalText(4000),
  })
  .strict()
  .refine((c) => contactDisplayName(c) !== "", {
    message: "Un nom, un prénom ou une entreprise est requis",
    path: ["lastName"],
  });

export type ContactInput = z.infer<typeof contactInput>;

export const workInput = z
  .object({
    id: uuid.nullable(),
    contactId: uuid,
    title: text(300).min(1, "Titre requis"),
    author: optionalText(200),
    editionNote: optionalText(300),
    description: optionalText(2000),
    heightMm: mm,
    widthMm: mm,
    thicknessMm: mm,
    weightGrams: z.number().int().min(1).max(50_000).nullable(),
    declaredValueCents: z.number().int().min(0).max(100_000_000).nullable(),
    conditionNotes: optionalText(2000),
    internalNotes: optionalText(4000),
  })
  .strict();

export type WorkInput = z.infer<typeof workInput>;

export const idInput = z.object({ id: z.string().uuid() }).strict();

export const worksFilterInput = z
  .object({
    contactId: uuid.optional(),
    includeArchived: z.boolean().optional(),
  })
  .strict();
