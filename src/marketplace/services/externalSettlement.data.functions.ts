import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { requireBinderId } from "./binderQuotes.server";

const id = z.object({ id: z.string().uuid() }).strict();
const evidence = z.string().trim().min(8).max(500);
export interface OwnContract { eligible: boolean; version: string; currency: string; totalCents: number; feeCents: number; evidence: string | null }
export interface SettlementState {
  eligible: boolean; currency: string; totalCents: number; netCents: number; disputed: boolean;
  events: { id: string; kind: string; amount_cents: number; currency: string; evidence: string; created_at: string }[];
}
async function scope(userId: string) {
  const sb = await admin();
  return { sb, binderId: await requireBinderId(sb, userId) };
}
export const getOwnContract = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => id.parse(data)).handler(async ({ context, data }) => {
    const { sb, binderId } = await scope(context.userId);
    const result = await sb.rpc("marketplace_own_contract", { p_quote: data.id, p_binder: binderId, p_actor: context.userId });
    if (result.error) fail(409, "Conditions du règlement indisponibles.");
    return result.data as unknown as OwnContract;
  });
export const acceptOwnQuote = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => id.extend({ evidence }).strict().parse(data)).handler(async ({ context, data }) => {
    const { sb, binderId } = await scope(context.userId);
    const result = await sb.rpc("marketplace_accept_own_quote", { p_quote: data.id, p_binder: binderId, p_actor: context.userId, p_evidence: data.evidence });
    if (result.error) fail(409, "Accord non enregistré. Vérifiez le devis envoyé, son origine et la référence de l'accord client.");
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
