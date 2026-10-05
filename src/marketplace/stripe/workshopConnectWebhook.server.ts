import type Stripe from "stripe";
import { admin } from "@/build/services/adminAuth.server";
import { getMarketplaceStripeClient } from "./stripeClient.server";
import {
  claimWebhookEvent,
  markWebhookEventFailed,
  markWebhookEventProcessed,
} from "@/marketplace/services/stripeWebhookLog.server";
import { processWorkshopConnectEvent } from "./workshopOnlinePayment.server";

export async function handleWorkshopConnectWebhook(request: Request): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "signature_required" }, { status: 400 });
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "webhook_unconfigured" }, { status: 503 });
  let event: Stripe.Event;
  try {
    event = await getMarketplaceStripeClient().webhooks.constructEventAsync(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  }
  if (!event.account)
    return Response.json({ error: "connected_account_required" }, { status: 400 });
  const sb = await admin();
  const claim = await claimWebhookEvent(sb, { id: event.id, type: event.type, payload: event });
  if (claim.outcome === "already_processed") return Response.json({ ok: true, duplicate: true });
  if (claim.outcome === "in_progress")
    return Response.json({ error: "in_progress" }, { status: 409 });
  try {
    await processWorkshopConnectEvent(sb, event);
    await markWebhookEventProcessed(sb, event.id);
    return Response.json({ ok: true });
  } catch {
    await markWebhookEventFailed(sb, event.id, "workshop_connect_processing_failed");
    return Response.json({ error: "processing_failed" }, { status: 500 });
  }
}
