/**
 * Points d'entrée navigateur du parcours d'acheminement. Minces : l'identité vient de la session,
 * la décision de `caseLogistics.server.ts` et de la base. Les erreurs sortent en codes stables
 * (`logisticsPlan.ts`), traduits par chaque écran — jamais un message technique brut.
 */
import { createServerFn } from "@tanstack/react-start";
import { Buffer } from "node:buffer";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, assertAdmin } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { parcelInput, planInput, receptionInput } from "@/marketplace/shipping/logisticsPlan";
import {
  confirmCustomerReturnAddress, customerLogistics, declareReturnReady, decideWorkshopReception, labelUrl,
  LogisticsError, operatorConfirmManual, operatorLogistics, operatorRecordJobEvent, operatorSetAutomation,
  saveCustomerPlan, workshopLogistics,
} from "./caseLogistics.server";
import { purchaseAutomatically, recordRateApproval, roundTripShippingOptions } from "./roundTripAutomation.server";

const caseId = z.string().uuid();
const direction = z.enum(["outbound", "return"]);

/** Une erreur métier devient un code lisible ; toute autre erreur reste une panne (jamais un succès). */
async function guarded<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof LogisticsError) fail(error.status, error.code);
    throw error;
  }
}

// --- Client ----------------------------------------------------------------
export const getMyCaseLogistics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ caseId }).strict().parse(data))
  .handler(async ({ context, data }) => guarded(async () => customerLogistics(await admin(), context.userId, data.caseId)));

export const saveMyCaseLogistics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const parsed = z.object({ caseId, plan: z.unknown() }).strict().parse(data);
    const plan = planInput.safeParse(parsed.plan);
    if (!plan.success) fail(400, "invalid_input");
    return { caseId: parsed.caseId, plan: plan.data };
  })
  .handler(async ({ context, data }) => guarded(async () => {
    await saveCustomerPlan(await admin(), context.userId, data.caseId, data.plan);
    return { ok: true as const };
  }));

export const confirmMyReturnAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ caseId }).strict().parse(data))
  .handler(async ({ context, data }) => guarded(async () => {
    await confirmCustomerReturnAddress(await admin(), context.userId, data.caseId);
    return { ok: true as const };
  }));

export const getMyOutboundLabel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ caseId }).strict().parse(data))
  .handler(async ({ context, data }) =>
    guarded(async () => labelUrl(await admin(), { role: "customer", userId: context.userId }, data.caseId, "outbound")));

// --- Atelier ---------------------------------------------------------------
export const getWorkshopCaseLogistics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ caseId }).strict().parse(data))
  .handler(async ({ context, data }) => guarded(async () => workshopLogistics(await admin(), context.userId, data.caseId)));

export const decideCaseReception = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const parsed = z.object({ caseId, decision: z.enum(["accepted", "declined"]), reception: z.unknown().nullable().default(null) })
      .strict().parse(data);
    if (parsed.decision === "declined") return { ...parsed, reception: null };
    const address = receptionInput.safeParse(parsed.reception);
    if (!address.success) fail(400, "invalid_input");
    return { ...parsed, reception: address.data };
  })
  .handler(async ({ context, data }) => guarded(async () => {
    await decideWorkshopReception(await admin(), context.userId, data.caseId, { decision: data.decision, reception: data.reception });
    return { ok: true as const };
  }));

export const declareCaseReturnReady = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const parsed = z.object({ caseId, parcel: z.unknown() }).strict().parse(data);
    const parcel = parcelInput.safeParse(parsed.parcel);
    if (!parcel.success) fail(400, "invalid_input");
    return { caseId: parsed.caseId, parcel: parcel.data };
  })
  .handler(async ({ context, data }) => guarded(async () => declareReturnReady(await admin(), context.userId, data.caseId, data.parcel)));

export const getWorkshopReturnLabel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ caseId }).strict().parse(data))
  .handler(async ({ context, data }) =>
    guarded(async () => labelUrl(await admin(), { role: "workshop", userId: context.userId }, data.caseId, "return")));

// --- Opérateur -------------------------------------------------------------
export const getOperatorCaseLogistics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ caseId }).strict().parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    return guarded(async () => operatorLogistics(await admin(), data.caseId));
  });

export const getOperatorLabel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ caseId, direction }).strict().parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    return guarded(async () => labelUrl(await admin(), { role: "operator" }, data.caseId, data.direction));
  });

const cents = z.number().int().min(0).max(100_000);
export const recordManualLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    caseId, direction,
    base64: z.string().min(16).max(7_000_000),
    carrier: z.string().trim().min(2).max(80),
    tracking: z.string().trim().min(4).max(80),
    method: z.string().trim().min(3).max(160),
    providerReference: z.string().trim().min(3).max(160),
    chargedCostTtcCents: cents,
    deficitAcknowledged: z.boolean().default(false),
    replace: z.boolean().default(false),
  }).strict().parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.toString("base64") !== data.base64) fail(400, "label_pdf_invalid");
    return guarded(async () => operatorConfirmManual(await admin(), context.userId, data.caseId, data.direction,
      new Uint8Array(bytes), {
        carrier: data.carrier, tracking: data.tracking, method: data.method, providerReference: data.providerReference,
        chargedCostTtcCents: data.chargedCostTtcCents, deficitAcknowledged: data.deficitAcknowledged,
      }, data.replace));
  });

export const recordLabelEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    caseId, jobId: z.string().uuid(),
    kind: z.enum(["purchase_failed", "cancellation_requested", "cancelled", "cost_adjusted", "unused", "operator_note"]),
    note: z.string().trim().max(500).optional(),
    reference: z.string().trim().max(160).optional(),
    chargedCostTtcCents: cents.optional(),
    refundedCostTtcCents: cents.optional(),
  }).strict().parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    return guarded(async () => {
      await operatorRecordJobEvent(await admin(), context.userId, data.caseId, data.jobId, data.kind, data);
      return { ok: true as const };
    });
  });

export const setRoundTripAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    enabled: z.boolean(),
    evidence: z.record(z.string().trim().max(500)).default({}),
  }).strict().parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    return guarded(async () => {
      await operatorSetAutomation(await admin(), context.userId, data.enabled, data.evidence);
      return { ok: true as const };
    });
  });

export const recordRoundTripRateApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    caseId,
    outboundOptionCode: z.string().trim().min(3).max(160),
    returnOptionCode: z.string().trim().min(3).max(160),
    providerQuoteReference: z.string().trim().min(3).max(160),
    coverageEvidenceReference: z.string().trim().min(3).max(160),
    outboundCostTtcCents: z.number().int().min(1).max(1500),
    returnCostTtcCents: z.number().int().min(1).max(1500),
    allOtherCostsTtcCents: z.number().int().min(0).max(1500),
    estimatedEconomicCostCents: z.number().int().min(0).max(1250),
    economicCostEvidenceReference: z.string().trim().min(3).max(160),
    validUntil: z.string().datetime(),
  }).strict().parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    return guarded(async () => {
      await recordRateApproval(await admin(), context.userId, data.caseId, data);
      return { ok: true as const };
    });
  });

export const purchaseRoundTripLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ caseId, direction }).strict().parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    return guarded(async () => purchaseAutomatically(await admin(), data.caseId, data.direction));
  });

export const getRoundTripShippingOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ caseId }).strict().parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    return guarded(async () => roundTripShippingOptions(await admin(), data.caseId));
  });
