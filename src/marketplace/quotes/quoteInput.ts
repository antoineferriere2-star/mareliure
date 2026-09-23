/**
 * Ce que le navigateur a le droit d'envoyer pour un devis — et rien d'autre.
 *
 * Aucun total, aucune TVA calculée, aucun numéro, aucun statut : le serveur
 * recalcule tout avec `computeQuote` et attribue le numéro lui-même. Les
 * schémas sont `.strict()` : un champ en plus est refusé, pas ignoré.
 */
import { z } from "zod";
import { quantityToHundredths } from "./quoteCalc";

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

export const quoteLineInput = z
  .object({
    lineKey: text(100).min(1),
    blockKey: text(100).min(1),
    serviceId: uuid.nullable(),
    label: text(200).min(1, "Libellé requis"),
    description: optionalText(1000),
    unit: optionalText(40),
    quantity: z
      .number()
      .positive()
      .max(9999.99)
      .refine((q) => Number.isFinite(quantityToHundredths(q)), "Deux décimales au maximum"),
    unitPriceCents: z.number().int().min(0).max(100_000_000),
    catalogPriceCents: z.number().int().min(0).max(100_000_000).nullable(),
    vatRateBps: z.number().int().min(0).max(10_000),
    referenceVersion: optionalText(60).optional(),
    referenceOperationKey: optionalText(60).optional(),
  })
  .strict();

export const quoteBlockInput = z
  .object({
    key: text(100).min(1),
    label: text(120).min(1, "Nom du format requis"),
    bookCount: z.number().int().min(1).max(10_000),
    heightMm: mm,
    widthMm: mm,
    spineMm: mm,
  })
  .strict();

const discountInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("NONE") }).strict(),
  z.object({ type: z.literal("PERCENT"), bps: z.number().int().min(0).max(10_000) }).strict(),
  z.object({ type: z.literal("AMOUNT"), cents: z.number().int().min(0).max(100_000_000) }).strict(),
]);

export const quoteInput = z
  .object({
    /**
     * L'ouvrage auquel ce devis se rattache (facultatif). Une référence, pas une source de
     * vérité : le devis garde son propre snapshot du client et de l'ouvrage. Le serveur
     * vérifie que l'ouvrage est celui de CET atelier ; la base le vérifie aussi.
     */
    workId: uuid.optional(),
    /** Client existant ; `null` : un nouveau client est créé à partir de `client`. */
    clientId: uuid.nullable(),
    client: z
      .object({
        name: text(200).min(1, "Nom du client requis"),
        email: optionalText(200),
        phone: optionalText(40),
        addressLine1: optionalText(300),
        postalCode: optionalText(20),
        city: optionalText(120),
        country: optionalText(80),
      })
      .strict(),
    book: z
      .object({
        title: optionalText(300),
        author: optionalText(200),
        heightMm: mm,
        widthMm: mm,
        spineMm: mm,
        notes: optionalText(2000),
      })
      .strict(),
    blocks: z.array(quoteBlockInput).min(1, "Ajoutez au moins un format").max(20),
    lines: z.array(quoteLineInput).min(1, "Ajoutez au moins une prestation").max(100),
    discount: discountInput,
    deposit: discountInput,
    /** Durée de validité pour CE devis ; par défaut, celle du profil. */
    validityDays: z.number().int().min(1).max(365).nullable(),
    notes: optionalText(4000),
  })
  .strict()
  .superRefine((value, context) => {
    const blockKeys = new Set(value.blocks.map((block) => block.key));
    if (blockKeys.size !== value.blocks.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["blocks"], message: "Chaque format doit être unique" });
    }
    const lineKeys = new Set(value.lines.map((line) => line.lineKey));
    if (lineKeys.size !== value.lines.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["lines"], message: "Chaque ligne doit être unique" });
    }
    value.lines.forEach((line, index) => {
      if (!blockKeys.has(line.blockKey)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["lines", index, "blockKey"], message: "Format introuvable" });
      }
    });
  });

export type QuoteInput = z.infer<typeof quoteInput>;
export type QuoteLineInput = z.infer<typeof quoteLineInput>;
export type QuoteBlockInput = z.infer<typeof quoteBlockInput>;

// ---------------------------------------------------------------------------
// Profil de facturation
// ---------------------------------------------------------------------------

export const billingProfileInput = z
  .object({
    workshopName: optionalText(200),
    legalName: optionalText(200),
    addressLine1: optionalText(300),
    addressLine2: optionalText(300),
    postalCode: optionalText(20),
    city: optionalText(120),
    country: text(80).min(1).default("FR"),
    siret: optionalText(20),
    vatNumber: optionalText(30),
    legalNotes: optionalText(1000),
    email: optionalText(200),
    phone: optionalText(40),
    vatRegime: z.enum(["FRANCHISE", "VAT_LIABLE"]).nullable(),
    defaultVatRateBps: z.number().int().min(0).max(10_000),
    vatMention: optionalText(500),
    quotePrefix: z.string().trim().regex(/^[A-Za-z0-9]{1,8}$/, "1 à 8 lettres ou chiffres"),
    invoicePrefix: z.string().trim().regex(/^[A-Za-z0-9]{1,8}$/, "1 à 8 lettres ou chiffres"),
    quoteValidityDays: z.number().int().min(1).max(365),
    paymentTerms: optionalText(1000),
    quoteNotes: optionalText(2000),
    invoiceNotes: optionalText(2000),
  })
  .strict();

export type BillingProfileInput = z.infer<typeof billingProfileInput>;

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const serviceInput = z
  .object({
    id: uuid.nullable(),
    categoryId: uuid.nullable(),
    name: text(200).min(1, "Nom requis"),
    description: optionalText(1000),
    unitPriceCents: z.number().int().min(0).max(100_000_000),
    vatRateBps: z.number().int().min(0).max(10_000).nullable(),
    unit: optionalText(40),
    isActive: z.boolean(),
    /** Absent : le favori ne change pas. Le lien au référentiel n'est PAS un champ d'ici (voir `referenceServiceInput`). */
    isFavorite: z.boolean().optional(),
  })
  .strict();

export const categoryInput = z
  .object({ id: uuid.nullable(), name: text(120).min(1, "Nom requis"), sortOrder: z.number().int().min(0).max(10_000) })
  .strict();

export const clientInput = z
  .object({
    id: uuid.nullable(),
    name: text(200).min(1, "Nom requis"),
    email: optionalText(200),
    phone: optionalText(40),
    addressLine1: optionalText(300),
    postalCode: optionalText(20),
    city: optionalText(120),
    country: optionalText(80),
    notes: optionalText(2000),
  })
  .strict();

export type ServiceInput = z.infer<typeof serviceInput>;
export type CategoryInput = z.infer<typeof categoryInput>;
export type ClientInput = z.infer<typeof clientInput>;
