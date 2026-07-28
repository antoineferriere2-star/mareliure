// Stripe webhook — raw Stripe events proxied through the Lovable payments
// connector, NOT wrapped in a Lovable signature (that's @lovable.dev/webhooks-js,
// which only applies to email webhooks). Verified with the standard
// `stripe-signature` header against PAYMENTS_{SANDBOX,LIVE}_WEBHOOK_SECRET,
// selected by the `env` query param the endpoint is registered with.
import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { createStripeClient, getWebhookSecret, parseStripeEnv } from "@/lib/stripe.server";
import { mapLookupKeyToPlan, resolveWorkspaceId } from "@/build/billing/stripeSync";
import { resolvePlanColumnsUpdate } from "@/build/billing/planSync";
import { logOperationalError } from "@/build/services/operationalLog.server";
import type { Database } from "@/integrations/supabase/types";

type WorkspaceUpdate = Database["public"]["Tables"]["build_workspaces"]["Update"];

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleSubscriptionEvent(subscription: Stripe.Subscription) {
  const workspaceId = resolveWorkspaceId(subscription);
  if (!workspaceId) {
    logOperationalError(
      "payments-webhook.subscription-missing-workspace",
      new Error("Subscription event missing workspace_id metadata"),
      { subscriptionId: subscription.id },
    );
    return;
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const price = subscription.items.data[0]?.price;
  const plan = price ? mapLookupKeyToPlan(price) : null;

  const update: WorkspaceUpdate = {
    subscription_status: subscription.status,
    stripe_customer_id:
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    stripe_subscription_id: subscription.id,
  };

  if (plan) {
    Object.assign(update, resolvePlanColumnsUpdate(plan));
  } else {
    logOperationalError(
      "payments-webhook.plan-unresolved",
      new Error("Could not resolve a plan from Stripe price."),
      { priceId: price?.id, lookupKey: price?.lookup_key },
    );
  }

  const { error } = await supabaseAdmin
    .from("build_workspaces")
    .update(update)
    .eq("id", workspaceId);
  if (error) {
    logOperationalError("payments-webhook.workspace-update-failed", error, {
      workspaceId,
      subscriptionId: subscription.id,
    });
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const workspaceId = resolveWorkspaceId(subscription);
  if (!workspaceId) {
    logOperationalError(
      "payments-webhook.subscription-deleted-missing-workspace",
      new Error("subscription.deleted event missing workspace_id metadata"),
      { subscriptionId: subscription.id },
    );
    return;
  }
  // Status only — never auto-downgrade plan/quotas on cancellation, a human decides.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("build_workspaces")
    .update({ subscription_status: "canceled" })
    .eq("id", workspaceId);
  if (error) {
    logOperationalError("payments-webhook.workspace-cancel-failed", error, {
      workspaceId,
      subscriptionId: subscription.id,
    });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const workspaceId = resolveWorkspaceId(session);
  if (!workspaceId) {
    logOperationalError(
      "payments-webhook.checkout-missing-workspace",
      new Error("checkout.session.completed event missing workspace_id metadata"),
      { checkoutSessionId: session.id },
    );
    return;
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("build_workspaces")
    .update({
      stripe_customer_id:
        typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null),
      stripe_subscription_id:
        typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription?.id ?? null),
    })
    .eq("id", workspaceId);
  if (error) {
    logOperationalError("payments-webhook.checkout-record-failed", error, {
      workspaceId,
      checkoutSessionId: session.id,
    });
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        const env = parseStripeEnv(rawEnv);
        if (!env) {
          return jsonResponse(400, { error: "Invalid Stripe environment." });
        }
        const signature = request.headers.get("stripe-signature");
        if (!signature) return jsonResponse(400, { error: "Missing stripe-signature header." });

        const raw = await request.text();

        let event: Stripe.Event;
        try {
          const stripe = createStripeClient(env);
          event = await stripe.webhooks.constructEventAsync(raw, signature, getWebhookSecret(env));
        } catch (err) {
          logOperationalError("payments-webhook.signature-verification-failed", err, { env });
          return jsonResponse(400, { error: "Invalid signature." });
        }

        switch (event.type) {
          case "checkout.session.completed":
            await handleCheckoutCompleted(event.data.object);
            break;
          case "customer.subscription.created":
          case "customer.subscription.updated":
            await handleSubscriptionEvent(event.data.object);
            break;
          case "customer.subscription.deleted":
            await handleSubscriptionDeleted(event.data.object);
            break;
          default:
            break;
        }

        return jsonResponse(200, { received: true });
      },
    },
  },
});
