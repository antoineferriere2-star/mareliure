/** Branche le webhook Sendcloud signé sur la base : rapprochement fournisseur puis journal dédupliqué. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin } from "@/build/services/adminAuth.server";
import { handleSendcloudWebhook } from "@/marketplace/shipping/sendcloudWebhook";
import { supabaseLabelStore } from "@/marketplace/shipping/roundTripLabelStore.server";
import { providerFromEnv } from "./roundTripAutomation.server";

export async function handleRoundTripWebhookRequest(request: Request): Promise<Response> {
  const secret = process.env.SENDCLOUD_WEBHOOK_SECRET;
  const provider = providerFromEnv();
  if (!secret || !provider) return new Response("Not found", { status: 404 });
  const sb = await admin();
  return handleSendcloudWebhook(request, {
    secret,
    provider,
    store: supabaseLabelStore(sb),
    async jobByProviderLabel(labelId) {
      const { data, error } = await (sb as unknown as SupabaseClient).from("marketplace_round_trip_label_jobs")
        .select("id").eq("provider", provider.name).eq("provider_label_id", labelId).maybeSingle();
      if (error) throw new Error("label_job_unreadable");
      return data ? { id: data.id as string } : null;
    },
  });
}
