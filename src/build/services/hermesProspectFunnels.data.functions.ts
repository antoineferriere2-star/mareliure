import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, assertAdmin } from "./adminAuth.server";
import {
  retryHermesProspectFunnelById,
  runHermesProspectFunnelBatch,
} from "./hermesProspectFunnels.server";

const prospectInput = z.object({
  companyName: z.string().trim().max(200).optional().nullable(),
  websiteUrl: z.string().trim().min(1).max(2048),
  businessType: z.string().trim().max(80).optional().nullable(),
  product: z.string().trim().max(80).optional().nullable(),
  campaignId: z.string().trim().max(120).optional().nullable(),
  requestId: z.string().trim().min(8).max(80).optional().nullable(),
});

export const createHermesProspectFunnels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid().optional().nullable(),
        prospects: z.array(prospectInput).min(1).max(10),
        retryFailed: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    return runHermesProspectFunnelBatch(sb, {
      userId: context.userId,
      workspaceId: data.workspaceId,
      prospects: data.prospects,
      retryFailed: data.retryFailed ?? false,
    });
  });

export const retryHermesProspectFunnel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    return retryHermesProspectFunnelById(sb, { userId: context.userId, id: data.id });
  });
