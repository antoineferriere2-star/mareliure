/**
 * Plan logistique d'un dossier, choisi par le client AVANT l'accord : mode d'acheminement,
 * adresses (privées), colis emballé, nature et valeur déclarée du livre.
 *
 * L'autorité est la base (migration 20261002090000) : `roundTripPlanBlock` en est le jumeau,
 * pour expliquer à l'écran ce que la base refusera. Les plafonds sont une PRÉSÉLECTION métier
 * (colis ordinaire, livre courant), jamais une promesse du transporteur ni une assurance.
 */
import { z } from "zod";

export const LOGISTICS_MODES = ["organized_round_trip", "customer_arranged", "hand_delivery"] as const;
export type LogisticsMode = (typeof LOGISTICS_MODES)[number];
export const BOOK_KINDS = ["ordinary", "old_or_rare", "unique_or_heritage"] as const;
export type BookKind = (typeof BOOK_KINDS)[number];

/** Le seul produit transport vendable : ligne distincte, identifiant explicite, jamais déduit du montant. */
export const ROUND_TRIP_PRODUCT = "book_round_trip_fr" as const;
export const ROUND_TRIP_TTC_CENTS = 1_500;
/** 15 € TTC à 20 % de TVA française : 12,50 € HT. */
export const ROUND_TRIP_HT_CENTS = 1_250;
export const ROUND_TRIP_MAX_DECLARED_VALUE_CENTS = 10_000;
export const ROUND_TRIP_PARCEL_LIMITS = { weightGrams: 500, longestMm: 350, middleMm: 250, shortestMm: 80 } as const;

export type RoundTripBlock =
  | "brand_unsupported"
  | "mode_not_organized"
  | "valuable_book"
  | "workshop_acceptance_required"
  | "outside_mainland"
  | "parcel_review";

export interface Parcel { weightGrams: number; lengthMm: number; widthMm: number; heightMm: number }

export interface PostalAddress {
  name: string;
  line1: string;
  line2: string | null;
  postalCode: string;
  city: string;
  countryCode: string;
}

export interface LogisticsPlan {
  version: number;
  mode: LogisticsMode;
  contact: (PostalAddress & { phone: string }) | null;
  returnSameAddress: boolean;
  returnAddress: PostalAddress | null;
  parcel: Parcel | null;
  bookDescription: string;
  bookKind: BookKind;
  declaredValueCents: number;
  workshop: {
    binderId: string;
    decision: "accepted" | "declined";
    planVersion: number;
    decidedAt: string;
    reception: (PostalAddress & { phone: string | null }) | null;
  } | null;
  returnAddressConfirmedVersion: number | null;
  returnReady: { at: string; parcel: Parcel } | null;
}

export function frMainlandPostal(countryCode: string | null | undefined, postalCode: string | null | undefined): boolean {
  if (countryCode !== "FR" || !postalCode || !/^\d{5}$/.test(postalCode)) return false;
  const district = Number(postalCode.slice(0, 2));
  return district >= 1 && district <= 95 && district !== 20;
}

export function parcelWithinRoundTripLimits(parcel: Parcel | null): boolean {
  if (!parcel) return false;
  const values = [parcel.weightGrams, parcel.lengthMm, parcel.widthMm, parcel.heightMm];
  if (!values.every((n) => Number.isSafeInteger(n) && n > 0)) return false;
  const [longest, middle, shortest] = [parcel.lengthMm, parcel.widthMm, parcel.heightMm].sort((a, b) => b - a);
  const limits = ROUND_TRIP_PARCEL_LIMITS;
  return parcel.weightGrams <= limits.weightGrams && longest <= limits.longestMm &&
    middle <= limits.middleMm && shortest <= limits.shortestMm;
}

/** Jumeau de `marketplace_round_trip_plan_block` : `null` = l'offre 15 € TTC peut être proposée. */
export function roundTripPlanBlock(plan: LogisticsPlan, brand: string, selectedBinderId: string | null): RoundTripBlock | null {
  if (brand !== "MA_RELIURE" && brand !== "FINE_BINDERY") return "brand_unsupported";
  if (plan.mode !== "organized_round_trip") return "mode_not_organized";
  if (plan.bookKind !== "ordinary" || plan.declaredValueCents >= ROUND_TRIP_MAX_DECLARED_VALUE_CENTS) return "valuable_book";
  // Causes propres à l'envoi d'abord : le client doit les lire avant toute attente de l'atelier.
  if (!frMainlandPostal(plan.contact?.countryCode, plan.contact?.postalCode) ||
    (!plan.returnSameAddress && !frMainlandPostal(plan.returnAddress?.countryCode, plan.returnAddress?.postalCode)))
    return "outside_mainland";
  if (!parcelWithinRoundTripLimits(plan.parcel)) return "parcel_review";
  const workshop = plan.workshop;
  if (!workshop || workshop.decision !== "accepted" || workshop.planVersion !== plan.version ||
    !selectedBinderId || workshop.binderId !== selectedBinderId) return "workshop_acceptance_required";
  if (!frMainlandPostal(workshop.reception?.countryCode, workshop.reception?.postalCode)) return "outside_mainland";
  return null;
}

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const country = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/);
const phone = z.string().trim().regex(/^\+?[0-9 .()-]{6,24}$/);
const millimetres = z.number().int().min(1).max(2000);
const addressBase = z.object({
  name: text(2, 120), line1: text(3, 160), line2: z.string().trim().max(160).nullable().default(null),
  postalCode: text(2, 12), city: text(1, 100), countryCode: country,
}).strict();
const frenchPostalCode = (value: { postalCode: string; countryCode: string }, ctx: z.RefinementCtx) => {
  if (value.countryCode === "FR" && !/^\d{5}$/.test(value.postalCode))
    ctx.addIssue({ code: "custom", path: ["postalCode"], message: "postal_code_invalid" });
};
export const addressInput = addressBase.superRefine(frenchPostalCode);
const contactInput = addressBase.extend({ phone }).strict().superRefine(frenchPostalCode);
/** Adresse de réception déclarée par l'atelier ; téléphone facultatif. */
export const receptionInput = addressBase.extend({ phone: phone.nullable().default(null) }).strict().superRefine(frenchPostalCode);
export const parcelInput = z.object({
  weightGrams: z.number().int().min(1).max(30000),
  lengthMm: millimetres, widthMm: millimetres, heightMm: millimetres,
}).strict();

/** Ce que le client envoie. Aucun identifiant d'atelier, de prix ou de version n'est accepté. */
export const planInput = z.object({
  mode: z.enum(LOGISTICS_MODES),
  contact: contactInput.nullable().default(null),
  returnSameAddress: z.boolean().default(true),
  returnAddress: addressInput.nullable().default(null),
  parcel: parcelInput.nullable().default(null),
  bookDescription: text(3, 600),
  bookKind: z.enum(BOOK_KINDS),
  declaredValueCents: z.number().int().min(0).max(100_000_000),
  acceptConditions: z.literal(true),
}).strict().superRefine((value, ctx) => {
  if (value.mode !== "organized_round_trip") return;
  if (!value.contact) ctx.addIssue({ code: "custom", path: ["contact"], message: "address_required" });
  if (!value.parcel) ctx.addIssue({ code: "custom", path: ["parcel"], message: "parcel_required" });
  if (!value.returnSameAddress && !value.returnAddress)
    ctx.addIssue({ code: "custom", path: ["returnAddress"], message: "return_address_required" });
});
export type PlanInput = z.infer<typeof planInput>;

/** Colonnes écrites par le serveur ; les champs d'un mode sans transport organisé restent vides. */
export function planColumns(input: PlanInput) {
  const shipping = input.mode === "organized_round_trip";
  const contact = shipping ? input.contact : null;
  const back = shipping && !input.returnSameAddress ? input.returnAddress : null;
  const parcel = shipping ? input.parcel : null;
  return {
    mode: input.mode,
    contact_name: contact?.name ?? null, phone: contact?.phone ?? null,
    address_line1: contact?.line1 ?? null, address_line2: contact?.line2 || null,
    postal_code: contact?.postalCode ?? null, city: contact?.city ?? null, country_code: contact?.countryCode ?? null,
    return_same_address: shipping ? input.returnSameAddress : true,
    return_contact_name: back?.name ?? null, return_address_line1: back?.line1 ?? null,
    return_address_line2: back?.line2 || null, return_postal_code: back?.postalCode ?? null,
    return_city: back?.city ?? null, return_country_code: back?.countryCode ?? null,
    parcel_weight_grams: parcel?.weightGrams ?? null, parcel_length_mm: parcel?.lengthMm ?? null,
    parcel_width_mm: parcel?.widthMm ?? null, parcel_height_mm: parcel?.heightMm ?? null,
    book_description: input.bookDescription, book_kind: input.bookKind, declared_value_cents: input.declaredValueCents,
  };
}

/** Ligne SQL → plan typé. Tolère une ligne absente (aucun plan encore). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function planFromRow(row: any): LogisticsPlan | null {
  if (!row) return null;
  const parcel = (w: unknown, l: unknown, wi: unknown, h: unknown): Parcel | null =>
    typeof w === "number" && typeof l === "number" && typeof wi === "number" && typeof h === "number"
      ? { weightGrams: w, lengthMm: l, widthMm: wi, heightMm: h } : null;
  return {
    version: row.version,
    mode: row.mode,
    contact: row.address_line1 ? {
      name: row.contact_name, phone: row.phone, line1: row.address_line1, line2: row.address_line2,
      postalCode: row.postal_code, city: row.city, countryCode: row.country_code,
    } : null,
    returnSameAddress: row.return_same_address,
    returnAddress: row.return_address_line1 ? {
      name: row.return_contact_name, line1: row.return_address_line1, line2: row.return_address_line2,
      postalCode: row.return_postal_code, city: row.return_city, countryCode: row.return_country_code,
    } : null,
    parcel: parcel(row.parcel_weight_grams, row.parcel_length_mm, row.parcel_width_mm, row.parcel_height_mm),
    bookDescription: row.book_description,
    bookKind: row.book_kind,
    declaredValueCents: row.declared_value_cents,
    workshop: row.workshop_decision ? {
      binderId: row.workshop_binder_id, decision: row.workshop_decision, planVersion: row.workshop_plan_version,
      decidedAt: row.workshop_decided_at,
      reception: row.workshop_address_line1 ? {
        name: row.workshop_reception_name, line1: row.workshop_address_line1, line2: row.workshop_address_line2,
        postalCode: row.workshop_postal_code, city: row.workshop_city, countryCode: row.workshop_country_code,
        phone: row.workshop_phone,
      } : null,
    } : null,
    returnAddressConfirmedVersion: row.return_address_confirmed_version ?? null,
    returnReady: row.return_ready_at
      ? { at: row.return_ready_at, parcel: parcel(row.return_weight_grams, row.return_length_mm, row.return_width_mm, row.return_height_mm)! }
      : null,
  };
}

/** L'adresse de retour effective : celle du retour si distincte, sinon celle de l'aller. */
export function effectiveReturnAddress(plan: LogisticsPlan): PostalAddress | null {
  return plan.returnSameAddress ? plan.contact : plan.returnAddress;
}

/** Codes stables renvoyés par la base, traduits par chaque écran ; jamais affichés bruts. */
export const LOGISTICS_ERROR_CODES = [
  "logistics_plan_locked", "logistics_plan_version_stale", "logistics_plan_required",
  "workshop_acceptance_required", "platform_payment_required", "physical_receipt_required",
  "return_not_ready", "return_address_confirmation_required", "return_label_in_progress",
  "deficit_acknowledgement_required", "replacement_confirmation_required", "label_object_missing",
  "admin_required", "automation_closed", "round_trip_offer_required", "logistics_plan_changed_review_required",
  "accepted_workshop_required", "selected_workshop_required", "active_membership_required",
  "return_requires_accepted_proposal", "evidence_missing", "label_pdf_invalid", "invalid_input",
  "round_trip_not_eligible", "provider_unavailable", "not_found", "forbidden",
] as const;
export type LogisticsErrorCode = (typeof LOGISTICS_ERROR_CODES)[number];

/** Extrait le code stable d'un message d'erreur Postgres (`code` ou `code:détail`). */
export function logisticsErrorCode(message: string): LogisticsErrorCode | null {
  const head = message.trim().split(":")[0];
  return (LOGISTICS_ERROR_CODES as readonly string[]).includes(head) ? (head as LogisticsErrorCode) : null;
}
