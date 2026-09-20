/**
 * Le garde-fou serveur « ce dossier peut-il encore être (re)chiffré ? » (Phase 0 / P1-5).
 *
 * Relit le statut du dossier ET l'existence d'une proposition acceptée — jamais reçus du navigateur —
 * et applique `repriceVerdict` (pur, `cases/engagement.ts`). Le refus est net et lisible AVANT toute
 * écriture ; la base (trigger `marketplace_cases_guard_engagement`) reste la garantie pour tous les
 * autres écrivains.
 */
import type { Supa } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { REPRICE_BLOCK_MESSAGES, repriceVerdict } from "@/marketplace/cases/engagement";
import { proposalCarriesCurrentPrice } from "@/marketplace/commercial/authoritativePrice";
import { loadCaseContext } from "./caseRepository.server";
import { loadAcceptedCommercialProposal, loadCommercialProposalById } from "./commercialProposalRepository.server";

export async function assertPricingOpen(sb: Supa, caseId: string): Promise<void> {
  const { data: row, error } = await sb.from("marketplace_cases").select("status").eq("id", caseId).maybeSingle();
  if (error) fail(500, error.message);
  if (!row) fail(404, "Dossier introuvable");
  const accepted = await loadAcceptedCommercialProposal(sb, caseId);
  const verdict = repriceVerdict({ status: row.status, hasAcceptedProposal: accepted !== null });
  if (!verdict.allowed) fail(409, REPRICE_BLOCK_MESSAGES[verdict.reason]);
}

/**
 * Jamais d'acceptation d'une proposition périmée (Phase 0 / P1-4) : elle doit porter le prix validé
 * COURANT du dossier — sinon une nouvelle version est nécessaire. Une proposition déjà acceptée ou
 * inconnue n'est pas jugée ici (l'acceptation elle-même répond).
 */
export async function assertProposalPriceCurrent(sb: Supa, proposalId: string): Promise<void> {
  const candidate = await loadCommercialProposalById(sb, proposalId);
  if (!candidate || candidate.acceptedAt) return;
  const caseContext = await loadCaseContext(sb, candidate.caseId);
  if (!caseContext) return;
  const current = proposalCarriesCurrentPrice(candidate.customerServicePriceCents, {
    pricingStatus: caseContext.row.pricing_status,
    customerPriceCents: caseContext.row.customer_price_cents,
  });
  if (!current) {
    fail(409, "Le prix validé du dossier n'est plus celui de cette proposition : créez une nouvelle version.");
  }
}
