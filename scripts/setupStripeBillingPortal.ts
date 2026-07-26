/**
 * One-off, idempotent setup for the Stripe Customer Billing Portal default
 * configuration — required before createWorkspaceBillingPortalSession can
 * work (Stripe returns an error creating a portal session if no
 * configuration exists yet). Run once per environment (sandbox and live
 * separately, since they're different Stripe accounts behind the gateway).
 *
 * Run with: npx tsx scripts/setupStripeBillingPortal.ts [sandbox|live]
 *
 * Talks to Stripe directly via createStripeClient (no TanStack Start
 * dependency), same reasoning as scripts/seedDeckPlaybook.ts: this needs to
 * run outside of a real HTTP request.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createStripeClient, type StripeEnv } from "../src/lib/stripe.server";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDotEnv() {
  const envPath = resolve(__dirname, "..", ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^"(.*)"$/, "$1");
  }
}

async function main() {
  loadDotEnv();

  const envArg = process.argv[2];
  const env: StripeEnv = envArg === "live" ? "live" : "sandbox";
  console.log(`[setupStripeBillingPortal] target env: ${env}`);

  const stripe = createStripeClient(env);

  const existing = await stripe.billingPortal.configurations.list({ limit: 1 });
  if (existing.data.length > 0) {
    console.log(
      `[setupStripeBillingPortal] a configuration already exists (${existing.data[0].id}) — nothing to do.`,
    );
    return;
  }

  const products = await stripe.products.list({ active: true, limit: 100 });
  if (products.data.length === 0) {
    throw new Error(
      "No active Stripe products found — create the plan Prices before running this script.",
    );
  }

  const productsWithPrices = await Promise.all(
    products.data.map(async (product) => {
      const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
      return { product: product.id, prices: prices.data.map((price) => price.id) };
    }),
  );

  const configuration = await stripe.billingPortal.configurations.create({
    business_profile: { headline: "Métré Build — manage your subscription" },
    features: {
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        products: productsWithPrices.filter((p) => p.prices.length > 0),
      },
      subscription_cancel: { enabled: true },
      invoice_history: { enabled: true },
    },
  });

  console.log(`[setupStripeBillingPortal] created configuration ${configuration.id}.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
