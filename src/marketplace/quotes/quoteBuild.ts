/**
 * De la saisie du relieur à ce que la base enregistre — pur, sans accès base.
 *
 * Le serveur reçoit une saisie SANS montant (voir quoteInput.ts), la confronte au
 * profil de l'atelier, recalcule tout avec `computeQuote`, et produit les lignes
 * exactes que les fonctions SQL insèrent. Les montants viennent d'ici, jamais du
 * navigateur ; l'identité de l'émetteur, le régime de TVA et les mentions sont
 * recopiés dans le document (snapshot) : modifier le profil plus tard ne change
 * aucun devis existant.
 */
import { computeQuote, type DepositInput, type DiscountInput, type QuoteTotals, type VatRegime } from "./quoteCalc";
import type { QuoteInput } from "./quoteInput";
import { addDays } from "./quoteStatus";

export interface BillingProfile {
  workshopName: string | null;
  legalName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  siret: string | null;
  vatNumber: string | null;
  legalNotes: string | null;
  email: string | null;
  phone: string | null;
  /** `null` tant que l'atelier n'a pas choisi : aucun régime n'est présumé. */
  vatRegime: VatRegime | null;
  defaultVatRateBps: number;
  vatMention: string | null;
  quotePrefix: string;
  invoicePrefix: string;
  quoteValidityDays: number;
  paymentTerms: string | null;
  quoteNotes: string | null;
  invoiceNotes: string | null;
}

export const EMPTY_BILLING_PROFILE: BillingProfile = {
  workshopName: null,
  legalName: null,
  addressLine1: null,
  addressLine2: null,
  postalCode: null,
  city: null,
  country: "FR",
  siret: null,
  vatNumber: null,
  legalNotes: null,
  email: null,
  phone: null,
  vatRegime: null,
  defaultVatRateBps: 2000,
  vatMention: null,
  quotePrefix: "D",
  invoicePrefix: "F",
  quoteValidityDays: 30,
  paymentTerms: null,
  quoteNotes: null,
  invoiceNotes: null,
};

/**
 * Suggestion de mention en franchise en base de TVA, proposée à la saisie du
 * régime. C'est un TEXTE de départ que l'atelier peut modifier — Ma Reliure
 * n'impose aucun régime et ne vérifie pas la mention : à faire valider par
 * l'atelier ou son comptable.
 */
export const FRANCHISE_MENTION_SUGGESTION = "TVA non applicable, art. 293 B du CGI";

/** L'émetteur tel qu'il est imprimé et figé dans le document. */
export interface Issuer {
  workshopName: string | null;
  legalName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  siret: string | null;
  vatNumber: string | null;
  legalNotes: string | null;
  email: string | null;
  phone: string | null;
}

export function issuerOf(profile: BillingProfile): Issuer {
  return {
    workshopName: profile.workshopName,
    legalName: profile.legalName,
    addressLine1: profile.addressLine1,
    addressLine2: profile.addressLine2,
    postalCode: profile.postalCode,
    city: profile.city,
    country: profile.country,
    siret: profile.siret,
    vatNumber: profile.vatNumber,
    legalNotes: profile.legalNotes,
    email: profile.email,
    phone: profile.phone,
  };
}

export type QuoteErrorCode = "profile_incomplete" | "client_not_found" | "invalid_input";

export class QuoteError extends Error {
  readonly code: QuoteErrorCode;
  /** Ce qu'il manque au profil, dans les mots du relieur (jamais un nom de colonne). */
  readonly missing: string[];
  constructor(code: QuoteErrorCode, missing: string[] = []) {
    super(code);
    this.name = "QuoteError";
    this.code = code;
    this.missing = missing;
  }
}

const filled = (value: string | null | undefined) => Boolean(value && value.trim());

/**
 * La mention de TVA qui sera figée dans la facture d'un devis.
 *
 * Un devis se chiffre sans administratif : un devis en franchise peut donc naître
 * SANS mention, l'atelier complétant son profil plus tard. La facture, elle, doit
 * la porter. Règle unique, appliquée à l'identique par la fonction SQL de
 * conversion : la mention non blanche du devis prime (elle a été promise au client),
 * à défaut celle du profil. Une chaîne blanche vaut absence.
 */
export function effectiveVatMention(quoteMention: string | null, profileMention: string | null): string | null {
  if (filled(quoteMention)) return quoteMention!.trim();
  if (filled(profileMention)) return profileMention!.trim();
  return null;
}

/**
 * Ce qu'il faut avoir renseigné avant d'émettre. Volontairement court pour un
 * devis (un nom, un régime de TVA) : le relieur n'est jamais bloqué par de
 * l'administratif pour chiffrer un livre. Une facture exige l'identité complète.
 */
export function profileReadiness(
  profile: BillingProfile,
  kind: "quote" | "invoice",
): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!filled(profile.workshopName) && !filled(profile.legalName)) missing.push("Nom de l'atelier");
  if (profile.vatRegime === null) missing.push("Régime de TVA");
  if (kind === "invoice") {
    if (!filled(profile.addressLine1) || !filled(profile.postalCode) || !filled(profile.city)) missing.push("Adresse");
    if (!filled(profile.siret)) missing.push("SIRET");
    if (profile.vatRegime === "VAT_LIABLE" && !filled(profile.vatNumber)) missing.push("Numéro de TVA");
    if (profile.vatRegime === "FRANCHISE" && !filled(profile.vatMention)) missing.push("Mention de TVA");
  }
  return { ready: missing.length === 0, missing };
}

// ---------------------------------------------------------------------------
// Lignes SQL
// ---------------------------------------------------------------------------

export interface QuoteRow {
  client_id: string | null;
  issue_date: string;
  valid_until: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_address_line1: string | null;
  client_postal_code: string | null;
  client_city: string | null;
  client_country: string | null;
  book_title: string | null;
  book_author: string | null;
  height_mm: number | null;
  width_mm: number | null;
  spine_mm: number | null;
  book_notes: string | null;
  currency: string;
  issuer: Issuer;
  vat_regime: VatRegime;
  vat_mention: string | null;
  payment_terms: string | null;
  notes: string | null;
  subtotal_cents: number;
  discount_type: string;
  discount_value: number;
  discount_cents: number;
  total_ht_cents: number;
  total_vat_cents: number;
  total_ttc_cents: number;
  vat_breakdown: { vatRateBps: number; baseHtCents: number; vatCents: number }[];
  deposit_type: string;
  deposit_value: number;
  deposit_cents: number;
}

export interface QuoteItemRow {
  line_key: string;
  block_key: string;
  block_label: string;
  block_book_count: number;
  block_height_mm: number | null;
  block_width_mm: number | null;
  block_spine_mm: number | null;
  service_id: string | null;
  label: string;
  description: string | null;
  unit: string | null;
  quantity: number;
  unit_price_cents: number;
  catalog_price_cents: number | null;
  vat_rate_bps: number;
  total_ht_cents: number;
}

/** Les colonnes que les fonctions SQL attendent — vérifiées contre la migration par un test. */
export const QUOTE_ROW_KEYS: readonly (keyof QuoteRow)[] = [
  "client_id", "issue_date", "valid_until", "client_name", "client_email", "client_phone",
  "client_address_line1", "client_postal_code", "client_city", "client_country",
  "book_title", "book_author", "height_mm", "width_mm", "spine_mm", "book_notes",
  "currency", "issuer", "vat_regime", "vat_mention", "payment_terms", "notes",
  "subtotal_cents", "discount_type", "discount_value", "discount_cents",
  "total_ht_cents", "total_vat_cents", "total_ttc_cents", "vat_breakdown",
  "deposit_type", "deposit_value", "deposit_cents",
];

export const QUOTE_ITEM_ROW_KEYS: readonly (keyof QuoteItemRow)[] = [
  "line_key", "block_key", "block_label", "block_book_count", "block_height_mm", "block_width_mm", "block_spine_mm",
  "service_id", "label", "description", "unit", "quantity", "unit_price_cents",
  "catalog_price_cents", "vat_rate_bps", "total_ht_cents",
];

const valueOf = (input: DiscountInput | DepositInput): number =>
  input.type === "PERCENT" ? input.bps : input.type === "AMOUNT" ? input.cents : 0;

export function buildQuoteRows(args: {
  input: QuoteInput;
  profile: BillingProfile;
  /** AAAA-MM-JJ, fournie par l'appelant (l'horloge n'est jamais lue ici). */
  issueDate: string;
  clientId: string | null;
}): { quote: QuoteRow; items: QuoteItemRow[]; totals: QuoteTotals } {
  const { input, profile } = args;
  const readiness = profileReadiness(profile, "quote");
  if (!readiness.ready || profile.vatRegime === null) throw new QuoteError("profile_incomplete", readiness.missing);
  const regime = profile.vatRegime;
  // Compatibilité des appels internes et des documents créés avant les blocs :
  // ils deviennent un bloc unique qui reprend les dimensions de l'ouvrage.
  const inputBlocks = input.blocks?.length ? input.blocks : [{
    key: "format-principal",
    label: "Format principal",
    bookCount: 1,
    heightMm: input.book.heightMm,
    widthMm: input.book.widthMm,
    spineMm: input.book.spineMm,
  }];
  const blocks = new Map(inputBlocks.map((block) => [block.key, block]));
  const blockOf = (line: QuoteInput["lines"][number]) => blocks.get(line.blockKey ?? "format-principal") ?? inputBlocks[0];

  const totals = computeQuote({
    lines: input.lines.map((l) => ({ quantity: l.quantity * blockOf(l).bookCount, unitPriceCents: l.unitPriceCents, vatRateBps: l.vatRateBps })),
    vatRegime: regime,
    discount: input.discount,
    deposit: input.deposit,
  });

  const items: QuoteItemRow[] = input.lines.map((l, i) => ({
    line_key: l.lineKey ?? `position-${i + 1}`,
    block_key: l.blockKey ?? "format-principal",
    block_label: blockOf(l).label,
    block_book_count: blockOf(l).bookCount,
    block_height_mm: blockOf(l).heightMm,
    block_width_mm: blockOf(l).widthMm,
    block_spine_mm: blockOf(l).spineMm,
    service_id: l.serviceId,
    label: l.label,
    description: l.description,
    unit: l.unit,
    quantity: l.quantity,
    unit_price_cents: l.unitPriceCents,
    catalog_price_cents: l.catalogPriceCents,
    // En franchise en base, le taux enregistré est toujours 0.
    vat_rate_bps: regime === "FRANCHISE" ? 0 : l.vatRateBps,
    total_ht_cents: totals.lineTotalsCents[i],
  }));

  const validityDays = input.validityDays ?? profile.quoteValidityDays;
  const quote: QuoteRow = {
    client_id: args.clientId,
    issue_date: args.issueDate,
    valid_until: addDays(args.issueDate, validityDays),
    client_name: input.client.name,
    client_email: input.client.email,
    client_phone: input.client.phone,
    client_address_line1: input.client.addressLine1,
    client_postal_code: input.client.postalCode,
    client_city: input.client.city,
    client_country: input.client.country,
    book_title: input.book.title,
    book_author: input.book.author,
    height_mm: input.book.heightMm,
    width_mm: input.book.widthMm,
    spine_mm: input.book.spineMm,
    book_notes: input.book.notes,
    currency: "EUR",
    issuer: issuerOf(profile),
    vat_regime: regime,
    vat_mention: profile.vatMention,
    payment_terms: profile.paymentTerms,
    notes: input.notes ?? profile.quoteNotes,
    subtotal_cents: totals.subtotalCents,
    discount_type: input.discount.type,
    discount_value: valueOf(input.discount),
    discount_cents: totals.discountCents,
    total_ht_cents: totals.totalHtCents,
    total_vat_cents: totals.totalVatCents,
    total_ttc_cents: totals.totalTtcCents,
    vat_breakdown: totals.vatBreakdown,
    deposit_type: input.deposit.type,
    deposit_value: valueOf(input.deposit),
    deposit_cents: totals.depositCents,
  };
  return { quote, items, totals };
}
