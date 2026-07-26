// Server-only Stripe client, proxied through Lovable's connector gateway —
// STRIPE_SANDBOX_API_KEY / STRIPE_LIVE_API_KEY are opaque connection ids,
// never real Stripe secret keys, so requests must be rewritten to the
// gateway host and carry the connection + Lovable auth headers. No
// TanStack Start dependency here (just process.env) so this stays
// importable from both server functions and standalone Node scripts
// (see scripts/setupStripeBillingPortal.ts).
import Stripe from "stripe";

const GATEWAY = "https://connector-gateway.lovable.dev/stripe";

export type StripeEnv = "sandbox" | "live";

export function getStripeEnv(): StripeEnv {
  return process.env.NODE_ENV === "production" ? "live" : "sandbox";
}

export function createStripeClient(env: StripeEnv): Stripe {
  const connectionApiKey =
    process.env[env === "sandbox" ? "STRIPE_SANDBOX_API_KEY" : "STRIPE_LIVE_API_KEY"];
  const lovableApiKey = process.env.LOVABLE_API_KEY;
  if (!connectionApiKey || !lovableApiKey) {
    throw new Error(
      `Missing Stripe gateway credentials for env "${env}" (STRIPE_${env.toUpperCase()}_API_KEY / LOVABLE_API_KEY).`,
    );
  }

  return new Stripe(connectionApiKey, {
    apiVersion: "2026-06-24.dahlia",
    httpClient: Stripe.createFetchHttpClient((input, init) => {
      const url = (input instanceof Request ? input.url : input.toString()).replace(
        "https://api.stripe.com",
        GATEWAY,
      );
      return fetch(url, {
        ...init,
        headers: {
          ...Object.fromEntries(new Headers(init?.headers).entries()),
          "X-Connection-Api-Key": connectionApiKey,
          "Lovable-API-Key": lovableApiKey,
        },
      });
    }),
  });
}

export function getWebhookSecret(env: StripeEnv): string {
  const secret =
    process.env[
      env === "sandbox" ? "PAYMENTS_SANDBOX_WEBHOOK_SECRET" : "PAYMENTS_LIVE_WEBHOOK_SECRET"
    ];
  if (!secret) {
    throw new Error(`Missing PAYMENTS_${env.toUpperCase()}_WEBHOOK_SECRET.`);
  }
  return secret;
}
