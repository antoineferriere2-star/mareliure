import type Stripe from "stripe";
import { admin } from "@/build/services/adminAuth.server";
import { getMarketplaceStripeClient } from "./stripeClient.server";
import {
  claimWebhookEvent,
  markWebhookEventFailed,
  markWebhookEventProcessed,
} from "@/marketplace/services/stripeWebhookLog.server";
import { processWorkshopConnectEvent } from "./workshopOnlinePayment.server";
import { assertExpectedStripeAccount } from "./stripeClient.server";
import { refreshWorkshopConnectAccountById } from "./binderConnect.server";

export async function handleWorkshopConnectWebhook(request: Request): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "signature_required" }, { status: 400 });
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  const v2Secret = process.env.STRIPE_CONNECT_V2_WEBHOOK_SECRET;
  if (!secret && !v2Secret)
    return Response.json({ error: "webhook_unconfigured" }, { status: 503 });
  const body = await request.text();
  let event: Stripe.Event;
  try {
    if (!secret) throw new Error("snapshot_unconfigured");
    event = await getMarketplaceStripeClient().webhooks.constructEventAsync(
      body,
      signature,
      secret,
    );
  } catch {
    if (v2Secret) return handleAccountNotification(body, signature, v2Secret);
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

/** Thin Accounts v2 notifications use their own destination/signing secret. */
async function handleAccountNotification(body: string, signature: string, secret: string) {
  const stripe = getMarketplaceStripeClient();
  let notification: Stripe.V2.Core.EventNotification;
  try {
    notification = await stripe.parseEventNotificationAsync(body, signature, secret);
  } catch {
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  }
  if (
    !notification.type.startsWith("v2.core.account") ||
    !("related_object" in notification) ||
    notification.related_object?.type !== "v2.core.account" ||
    !("id" in notification.related_object) ||
    !notification.related_object.id.startsWith("acct_")
  ) {
    return Response.json({ error: "account_notification_required" }, { status: 400 });
  }
  const sb = await admin();
  const claim = await claimWebhookEvent(sb, {
    id: notification.id,
    type: notification.type,
    payload: JSON.parse(body),
  });
  if (claim.outcome === "already_processed") return Response.json({ ok: true, duplicate: true });
  if (claim.outcome === "in_progress")
    return Response.json({ error: "in_progress" }, { status: 409 });
  try {
    await assertExpectedStripeAccount();
    // Fetch the signed event, then reread the account's current state (out-of-order safe).
    const fetched = await notification.fetchEvent();
    if (fetched.id !== notification.id || fetched.type !== notification.type)
      throw new Error("account_notification_mismatch");
    await refreshWorkshopConnectAccountById(sb, notification.related_object.id);
    await markWebhookEventProcessed(sb, notification.id);
    return Response.json({ ok: true });
  } catch {
    await markWebhookEventFailed(sb, notification.id, "workshop_account_refresh_failed");
    return Response.json({ error: "processing_failed" }, { status: 500 });
  }
}
