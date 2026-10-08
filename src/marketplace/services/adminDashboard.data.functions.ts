import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, assertAdmin } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { readAdminDashboard } from "./adminDashboard.server";

const dashboardInput = z.object({ brand: z.enum(["ALL", "MA_RELIURE", "FINE_BINDERY"]), days: z.union([z.literal(7), z.literal(30), z.literal(90), z.null()]) });

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => dashboardInput.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = (await admin()) as unknown as SupabaseClient;
    try {
      return await readAdminDashboard(sb, context.userId, data, {
        providerConfigured: Boolean(process.env.SENDCLOUD_PUBLIC_KEY && process.env.SENDCLOUD_SECRET_KEY && process.env.SENDCLOUD_WEBHOOK_SECRET),
      });
    } catch (error) {
      console.error("admin_dashboard_unreadable", error instanceof Error ? error.message : error);
      fail(500, "Le tableau de bord n'a pas pu être chargé.");
    }
  });
