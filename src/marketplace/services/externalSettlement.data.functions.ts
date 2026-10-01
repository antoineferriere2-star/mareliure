import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { requireWorkshopAccess } from "./workshopAccess.server";

const id = z.object({ id: z.string().uuid() }).strict();
const evidence = z.string().trim().min(8).max(500);
/** Pourquoi l'accord du circuit externe ne peut pas encore être enregistré (audit #53, C1/C2). */
export type OwnContractBlocker = "seller_identity_missing" | "validity_expired" | "send_first";
export interface OwnContract {
  eligible: boolean; version: string; revision: string; currency: string; totalCents: number; feeCents: number; evidence: string | null;
  /** Client propre sans acompte : le circuit « règlement externe déclaré » s'applique. */
  circuitApplies: boolean;
  /** L'acceptation passe obligatoirement par un accord référencé. */
  agreementRequired: boolean;
  blocker: OwnContractBlocker | null;
}
/** Raison pour laquelle une facture n'a pas de suivi des règlements (aucun accord fabriqué après coup). */
export type SettlementUnavailableReason =
  | "not_issued" | "historical_before_circuits" | "network" | "unverified_contact" | "review_required" | "deposit" | "accepted_without_agreement";
export interface SettlementState {
  eligible: boolean; currency: string; totalCents: number; netCents: number; disputed: boolean;
  reason: SettlementUnavailableReason | null;
  events: { id: string; kind: string; amount_cents: number; currency: string; evidence: string; created_at: string }[];
}
export type AgreementIdentityState =
  | "complete" | "completed_by_attestation" | "attestation_required" | "profile_identifier_missing" | "seller_changed";
export interface AgreementIdentity {
  agreement: boolean;
  state?: AgreementIdentityState;
  attestation?: { text: string; at: string } | null;
}

async function scope(userId: string) {
  const sb = await admin();
  return { sb, binderId: await requireWorkshopAccess(sb, userId) };
}
export const getOwnContract = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => id.parse(data)).handler(async ({ context, data }) => {
    const { sb, binderId } = await scope(context.userId);
    const result = await sb.rpc("marketplace_own_contract", { p_quote: data.id, p_binder: binderId, p_actor: context.userId });
    if (result.error) fail(409, "Conditions du règlement indisponibles.");
    return result.data as unknown as OwnContract;
  });
export const acceptOwnQuote = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => id.extend({ evidence, revision: z.string().regex(/^[a-f0-9]{32}$/) }).strict().parse(data)).handler(async ({ context, data }) => {
    const { sb, binderId } = await scope(context.userId);
    const result = await sb.rpc("marketplace_accept_own_quote", { p_quote: data.id, p_binder: binderId, p_actor: context.userId, p_evidence: data.evidence, p_revision: data.revision });
    if (result.error) fail(409, "Accord non enregistré. Vérifiez le devis envoyé, son origine et la référence de l'accord client.");
    return { ok: true };
  });
/** État de l'identité vendeur d'un accord déjà enregistré (audit #53, C1). */
export const getAgreementIdentity = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => id.parse(data)).handler(async ({ context, data }) => {
    const { sb, binderId } = await scope(context.userId);
    const result = await sb.rpc("marketplace_own_agreement_identity", { p_quote: data.id, p_binder: binderId, p_actor: context.userId });
    if (result.error) fail(409, "Identité du vendeur indisponible.");
    return result.data as unknown as AgreementIdentity;
  });
/**
 * Attestation explicite : l'identifiant ajouté au profil complète l'identité du MÊME vendeur.
 * L'accord reste intact ; un changement de vendeur exige un nouveau devis et un nouvel accord.
 */
export const completeAgreementIdentity = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => id.extend({ attestation: evidence }).strict().parse(data)).handler(async ({ context, data }) => {
    const { sb, binderId } = await scope(context.userId);
    const result = await sb.rpc("marketplace_complete_own_agreement_identity", { p_quote: data.id, p_binder: binderId, p_actor: context.userId, p_attestation: data.attestation });
    if (result.error) fail(409, "Attestation non enregistrée : l'identité du vendeur a changé ou le profil n'a pas d'identifiant d'entreprise.");
    return { ok: true };
  });
export const getExternalSettlements = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => id.parse(data)).handler(async ({ context, data }) => {
    const { sb, binderId } = await scope(context.userId);
    const result = await sb.rpc("marketplace_external_settlement_state", { p_invoice: data.id, p_binder: binderId, p_actor: context.userId });
    if (result.error) fail(409, "Suivi des règlements indisponible.");
    return result.data as unknown as SettlementState;
  });
export const recordExternalSettlement = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid(), invoiceId: z.string().uuid(),
    kind: z.enum(["receipt", "refund", "dispute_open", "dispute_close"]), amountCents: z.number().int().min(0).max(2147483647), evidence,
  }).strict().parse(data)).handler(async ({ context, data }) => {
    const { sb, binderId } = await scope(context.userId);
    const result = await sb.rpc("marketplace_record_external_settlement", { p_id: data.id, p_invoice: data.invoiceId,
      p_binder: binderId, p_actor: context.userId, p_kind: data.kind, p_amount: data.amountCents, p_evidence: data.evidence });
    if (result.error) fail(409, "Écriture non enregistrée : vérifiez le solde, le litige et l'unicité du justificatif. Aucun mouvement bancaire n'a été déclenché.");
    return { ok: true };
  });
