/**
 * La politique fiscale d'une proposition commerciale — l'application décide
 * la catégorie, Stripe ne fait qu'exécuter le calcul configuré (brief du
 * 17 septembre 2026, §4). Rien ici ne fixe un taux ou une exonération à
 * partir d'une interprétation maison (§6) : la géographie (quels pays sont
 * dans l'UE) est un fait, pas une règle fiscale, et c'est la seule chose que
 * ce module se permet de coder en dur. Le taux retenu, le pays de taxation
 * et la base imposable restent une décision humaine, tracée par
 * `tax_validated_at`/`tax_validated_by`/`tax_validation_source` — tant
 * qu'aucune de ces validations n'existe pour une proposition donnée, elle
 * reste `MANUAL_TAX_REVIEW` (garanti aussi au niveau base, voir la
 * migration 20260917090000).
 */
import type { CommercialTaxPolicy } from "./commercialProposal";

export const TAX_POLICIES: readonly CommercialTaxPolicy[] = [
  "MANUAL_TAX_REVIEW",
  "FR_B2C",
  "EU_B2C",
  "NON_EU_B2C",
  "NON_EU_TEMPORARY_IMPORT_REEXPORT",
];

export function isCommercialTaxPolicy(value: string): value is CommercialTaxPolicy {
  return (TAX_POLICIES as readonly string[]).includes(value);
}

/**
 * États membres de l'UE, ISO 3166-1 alpha-2, au 17 septembre 2026 — une
 * liste géographique, pas une affirmation sur le régime de TVA applicable à
 * un pays donné.
 */
export const EU_MEMBER_COUNTRY_CODES: ReadonlySet<string> = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE",
]);

/**
 * Une suggestion de pré-remplissage pour l'écran admin — jamais une
 * décision : `checkoutEligibility` ne lit jamais cette fonction, seulement
 * `tax_validated_at` (§6, §10). `NON_EU_TEMPORARY_IMPORT_REEXPORT` n'est
 * jamais suggérée automatiquement : qu'un livre soit envoyé pour
 * restauration puis réexporté est un fait que seul un humain qui lit le
 * dossier peut constater, jamais une déduction depuis un code pays.
 */
export function suggestTaxPolicyForCountry(countryCode: string | null): CommercialTaxPolicy {
  if (!countryCode) return "MANUAL_TAX_REVIEW";
  const code = countryCode.trim().toUpperCase();
  if (code === "FR") return "FR_B2C";
  if (EU_MEMBER_COUNTRY_CODES.has(code)) return "EU_B2C";
  if (/^[A-Z]{2}$/.test(code)) return "NON_EU_B2C";
  return "MANUAL_TAX_REVIEW";
}

export interface TaxValidationInput {
  policy: CommercialTaxPolicy;
  country: string | null;
  vatRateBps: number | null;
}

export type TaxValidationRejectionReason =
  | "manual_review_is_not_a_validated_policy"
  | "country_required"
  | "vat_rate_out_of_range";

export type TaxValidationCheck = { ok: true } | { ok: false; reason: TaxValidationRejectionReason };

/**
 * Garde structurelle minimale — ne juge jamais si le taux choisi par
 * l'admin est le bon (c'est le rôle d'un expert-comptable, pas du code),
 * seulement que la saisie peut matériellement constituer une validation.
 * 30 % est un plafond de bon sens contre une faute de frappe (bps au lieu
 * de %), pas une borne fiscale.
 */
export function validateTaxPolicySelection(input: TaxValidationInput): TaxValidationCheck {
  if (input.policy === "MANUAL_TAX_REVIEW") {
    return { ok: false, reason: "manual_review_is_not_a_validated_policy" };
  }
  if (!input.country || !input.country.trim()) {
    return { ok: false, reason: "country_required" };
  }
  if (input.vatRateBps !== null && (input.vatRateBps < 0 || input.vatRateBps > 3_000)) {
    return { ok: false, reason: "vat_rate_out_of_range" };
  }
  return { ok: true };
}

export interface TaxRecomputationBase {
  customerServicePriceCents: number;
  shippingTotalCents: number;
  depositAmountCents: number;
}

export interface TaxRecomputationResult {
  customerTotalHtCents: number;
  customerVatAmountCents: number | null;
  customerTotalTtcCents: number | null;
  balanceDueCents: number;
}

/**
 * La même arithmétique HT-first que `buildCommercialProposalSnapshot`
 * (§7) — reprise ici en une fonction pure séparée plutôt que réutilisée
 * telle quelle : reconstruire l'objet `Input` complet (shipping, deposit en
 * sous-objets) depuis une ligne déjà en base, pour ne recalculer que la TVA,
 * ajouterait plus de risque qu'il n'en retire.
 */
export function recomputeProposalTax(
  base: TaxRecomputationBase,
  vatRateBps: number | null,
): TaxRecomputationResult {
  const customerTotalHtCents = base.customerServicePriceCents + base.shippingTotalCents;
  const customerVatAmountCents =
    vatRateBps !== null ? Math.round((customerTotalHtCents * vatRateBps) / 10_000) : null;
  const customerTotalTtcCents =
    customerVatAmountCents !== null ? customerTotalHtCents + customerVatAmountCents : null;
  const balanceDueCents = Math.max(0, customerTotalHtCents - base.depositAmountCents);
  return { customerTotalHtCents, customerVatAmountCents, customerTotalTtcCents, balanceDueCents };
}
