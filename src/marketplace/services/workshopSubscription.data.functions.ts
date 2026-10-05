import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin } from "@/build/services/adminAuth.server";
import { findActiveBinderMembership } from "./binderMembership.server";
import { fail } from "@/build/services/serverError";
import {
  createWorkshopCheckout,
  loadWorkshopSubscription,
  workshopBillingOwner,
} from "./workshopSubscription.server";
import {
  assertExpectedStripeAccount,
  getMarketplaceStripeClient,
} from "@/marketplace/stripe/stripeClient.server";
import { workshopOrigin } from "@/marketplace/billing/workshopSubscription";

export const getMyWorkshopSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const member = await findActiveBinderMembership(sb, context.userId);
    if (!member) fail(403, "no_binder");
    const state = await loadWorkshopSubscription(sb, member!.binderId);
    return { ...state, isOwner: member!.role === "OWNER" };
  });

export const createMyWorkshopCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ accepted: z.literal(true) })
      .strict()
      .parse(data),
  )
  .handler(async ({ context, data }) =>
    createWorkshopCheckout(await admin(), context.userId, data.accepted),
  );

export const createMyWorkshopBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const binderId = await workshopBillingOwner(sb, context.userId);
    const { subscription } = await loadWorkshopSubscription(sb, binderId);
    if (!subscription.stripe_customer_id) fail(409, "Aucun abonnement à gérer.");
    await assertExpectedStripeAccount();
    const portal = await getMarketplaceStripeClient().billingPortal.sessions.create({
      customer: subscription.stripe_customer_id!,
      return_url: `${workshopOrigin()}/atelier/abonnement`,
    });
    return { url: portal.url };
  });
