// Self-service Stripe checkout + billing portal for a workspace's own
// members (Espace Client). Mirrors the auth pattern already used by
// getMyWorkspaceUsage in portal.data.functions.ts: requireSupabaseAuth +
// assertWorkspaceMember on the caller's own RLS-scoped client, service-role
// client only for the actual Stripe/DB work.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertWorkspaceOwner } from "./workspaceAuth.server";
import { admin } from "./adminAuth.server";
import { createStripeClient, getStripeEnv } from "@/lib/stripe.server";
import { PLAN_IDS, getPlanDefaults } from "@/build/billing/plans";
import { canCreateCheckout } from "@/build/billing/checkoutDecision";
import { fail } from "./serverError";

export const createWorkspaceCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        plan: z.enum(PLAN_IDS),
        origin: z.string().url(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertWorkspaceOwner(context.supabase, context.userId, data.workspaceId);
    const sb = await admin();

    if (data.plan === "enterprise") {
      fail(400, "Enterprise has no self-service price — contact the team.");
    }

    const lookupKey = getPlanDefaults(data.plan).stripeLookupKey;
    if (!lookupKey) {
      fail(400, "This plan has no Stripe price configured.");
    }

    const { data: workspace, error: workspaceError } = await sb
      .from("build_workspaces")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("id", data.workspaceId)
      .maybeSingle();
    if (workspaceError) fail(500, workspaceError.message);
    if (!workspace) fail(404, "Workspace not found.");
    if (!canCreateCheckout(workspace)) {
      fail(
        409,
        "This workspace already has Stripe billing. Open the billing portal to change plan.",
      );
    }

    const stripe = createStripeClient(getStripeEnv());
    const { data: prices } = await stripe.prices.list({
      lookup_keys: [lookupKey],
      active: true,
      limit: 1,
    });
    const price = prices[0];
    if (!price) {
      fail(500, `No active Stripe price found for "${lookupKey}".`);
    }

    const email = typeof context.claims.email === "string" ? context.claims.email : undefined;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: price.id, quantity: 1 }],
      customer_email: email,
      success_url: `${data.origin}/portal/billing?checkout=success`,
      cancel_url: `${data.origin}/portal/billing?checkout=cancel`,
      metadata: { workspace_id: data.workspaceId },
      subscription_data: { metadata: { workspace_id: data.workspaceId } },
    });

    if (!session.url) fail(500, "Stripe did not return a checkout URL.");
    return { url: session.url };
  });

export const createWorkspaceBillingPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ workspaceId: z.string().uuid(), origin: z.string().url() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertWorkspaceOwner(context.supabase, context.userId, data.workspaceId);

    const sb = await admin();
    const { data: workspace, error } = await sb
      .from("build_workspaces")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("id", data.workspaceId)
      .maybeSingle();
    if (error) fail(500, error.message);
    if (!workspace?.stripe_customer_id) {
      fail(400, "No active subscription yet for this workspace.");
    }

    const stripe = createStripeClient(getStripeEnv());
    const portal = await stripe.billingPortal.sessions.create({
      customer: workspace.stripe_customer_id,
      return_url: `${data.origin}/portal/billing`,
    });

    return { url: portal.url };
  });
