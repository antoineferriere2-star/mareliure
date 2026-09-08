/**
 * What a relieur may propose, and when.
 *
 * Pure rules, no I/O — the server function validates with these before it
 * writes, and the form shows the same messages, so a relieur never discovers a
 * constraint by having a save rejected.
 */
import { MARKETPLACE_CURRENCY, MAX_BINDERS_PER_CASE } from "@/marketplace/config";

export const QUOTE_STATES = ["submitted", "selected", "rejected", "expired", "withdrawn"] as const;
export type QuoteState = (typeof QUOTE_STATES)[number];

/**
 * Appended to every proposal, verbatim (§36). A relieur pricing from photos is
 * making an informed estimate, not a commitment sight-unseen, and saying so up
 * front is what makes an amendment later a conversation rather than a dispute.
 */
export const QUOTE_CAVEAT =
  "Devis sous réserve de confirmation après inspection physique de l'ouvrage.";

const MIN_AMOUNT_CENTS = 1_000; // 10 €
const MAX_AMOUNT_CENTS = 2_000_000; // 20 000 €
const MAX_LEAD_TIME_WEEKS = 104;

export interface QuoteInput {
  description: string;
  technique?: string | null;
  materials?: string | null;
  options?: string | null;
  amountCents: number;
  leadTimeWeeks: number;
  caveats?: string | null;
  validUntil?: string | null;
}

/** Empty when the proposal can be saved. Otherwise, sentences the relieur can act on. */
export function validateQuote(input: QuoteInput, now: Date = new Date()): string[] {
  const problems: string[] = [];

  if (input.description.trim().length < 20) {
    problems.push(
      "Décrivez l'intervention en quelques phrases : c'est ce que le client compare, bien avant le prix.",
    );
  }
  if (input.description.length > 4000) {
    problems.push("La description est trop longue (4 000 caractères maximum).");
  }

  if (!Number.isInteger(input.amountCents)) {
    problems.push("Le montant doit être un nombre entier de centimes.");
  } else if (input.amountCents < MIN_AMOUNT_CENTS || input.amountCents > MAX_AMOUNT_CENTS) {
    problems.push("Le montant doit être compris entre 10 € et 20 000 €.");
  }

  if (!Number.isInteger(input.leadTimeWeeks) || input.leadTimeWeeks < 1) {
    problems.push("Indiquez un délai en semaines.");
  } else if (input.leadTimeWeeks > MAX_LEAD_TIME_WEEKS) {
    problems.push("Le délai ne peut pas dépasser deux ans.");
  }

  if (input.validUntil) {
    const until = new Date(`${input.validUntil}T23:59:59.999Z`);
    if (Number.isNaN(until.getTime())) {
      problems.push("La date de validité n'est pas valide.");
    } else if (until.getTime() <= now.getTime()) {
      problems.push("La date de validité doit être postérieure à aujourd'hui.");
    }
  }

  return problems;
}

/**
 * A relieur may propose only on a case they were actually invited to, and only
 * while it is still open for proposals. Declining is final for that round —
 * re-inviting is the admin's decision, not the relieur's.
 */
export function canBinderQuote(input: { caseStatus: string; matchState: string | null }): {
  allowed: boolean;
  reason?: string;
} {
  if (input.matchState === null) {
    return { allowed: false, reason: "Ce dossier ne vous a pas été confié." };
  }
  if (input.matchState === "declined") {
    return { allowed: false, reason: "Vous avez décliné ce dossier." };
  }
  if (!["sent_to_binders", "quotes_received"].includes(input.caseStatus)) {
    return { allowed: false, reason: "Ce dossier n'attend plus de proposition." };
  }
  return { allowed: true };
}

export interface ComparableQuote {
  id: string;
  amountCents: number;
  leadTimeWeeks: number;
  submittedAt: string;
}

/**
 * The order the customer sees. Deliberately chronological, never by price:
 * ranking by amount turns three considered proposals into a cheapest-wins list
 * and pushes artisans to compete on the one dimension that says least about
 * the work (§37). The UI shows no "best price" badge for the same reason.
 */
export function orderQuotesForComparison<T extends ComparableQuote>(quotes: readonly T[]): T[] {
  return [...quotes]
    .slice(0, MAX_BINDERS_PER_CASE)
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt) || a.id.localeCompare(b.id));
}

export const QUOTE_CURRENCY = MARKETPLACE_CURRENCY;
