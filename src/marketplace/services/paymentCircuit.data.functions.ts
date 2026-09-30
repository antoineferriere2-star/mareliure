import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, assertAdmin } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";

/** Explicit, audited classification only. Does not activate collection or price a contract. */
export const reviewCasePaymentCircuit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({
    caseId: z.string().uuid(),
    circuit: z.enum(["own_client", "network_sale", "concierge"]),
    evidenceEventId: z.string().uuid(),
    notes: z.string().trim().min(12).max(2000),
  }).strict().parse(value))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { error } = await sb.rpc("marketplace_set_case_payment_circuit", {
      p_case_id: data.caseId, p_circuit: data.circuit, p_event_id: data.evidenceEventId,
      p_actor: context.userId, p_notes: data.notes,
    });
    if (error) fail(409, "Circuit non modifié : vérifier la preuve du dossier et les engagements déjà proposés ou acceptés.");
    return { ok: true };
  });
