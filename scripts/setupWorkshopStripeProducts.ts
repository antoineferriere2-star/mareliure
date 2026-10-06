/** Crée le catalogue B sans ouvrir la vente. Le mode et le compte sont explicites. */
import Stripe from "stripe";
import { existsSync, readFileSync } from "node:fs";
import { WORKSHOP_PRICE_LOOKUP_KEY } from "../src/marketplace/billing/workshopSubscription";
const mode = process.argv.includes("--live")
  ? "live"
  : process.argv.includes("--test")
    ? "test"
    : null;
if (!mode) throw new Error("Indiquez --test ou --live.");
const file = mode === "live" ? ".env.production.mareliure" : ".env";
if (existsSync(file))
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && !process.env[match[1]])
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
const key = process.env.STRIPE_SECRET_KEY;
if (!key?.startsWith(mode === "live" ? "sk_live_" : "sk_test_"))
  throw new Error("La clé Stripe ne correspond pas au mode demandé.");
const expected = mode === "live" ? "acct_1UGI34K0Q47WbZPf" : "acct_1UGISJKB3EBc6Slh";
const stripe = new Stripe(key, {
  apiVersion: "2026-09-30.endive",
  httpClient: Stripe.createFetchHttpClient(),
});
try {
  const account = await stripe.accounts.retrieveCurrent();
  if (account.id !== expected) throw new Error("Compte Stripe inattendu.");
  const prices = await stripe.prices.list({
    lookup_keys: [WORKSHOP_PRICE_LOOKUP_KEY],
    active: true,
    limit: 2,
  });
  if (prices.data.length > 1) throw new Error("Plusieurs prix actifs pour l'abonnement.");
  let price = prices.data[0];
  if (!price) {
    const products = await stripe.products.search({
      query: "metadata['activity']:'workshop_subscription' AND active:'true'",
      limit: 2,
    });
    if (products.data.length > 1) throw new Error("Plusieurs produits d'abonnement.");
    const product =
      products.data[0] ??
      (await stripe.products.create(
        {
          name: "Oppe — abonnement atelier",
          description: "Outil devis, factures et vitrine professionnelle. 15 € HT par mois.",
          metadata: { activity: "workshop_subscription" },
        },
        { idempotencyKey: "oppe-workshop-product-v1" },
      ));
    price = await stripe.prices.create(
      {
        product: product.id,
        currency: "eur",
        unit_amount: 1500,
        tax_behavior: "exclusive",
        recurring: { interval: "month" },
        lookup_key: WORKSHOP_PRICE_LOOKUP_KEY,
        metadata: { activity: "workshop_subscription" },
      },
      { idempotencyKey: "oppe-workshop-price-15-month-v1" },
    );
  }
  if (
    price.unit_amount !== 1500 ||
    price.currency !== "eur" ||
    price.tax_behavior !== "exclusive" ||
    price.recurring?.interval !== "month" ||
    price.recurring.interval_count !== 1
  )
    throw new Error("Prix Stripe incompatible.");
  console.log(
    JSON.stringify({
      mode,
      accountId: account.id,
      priceId: price.id,
      lookupKey: price.lookup_key,
      subscriptionOpen: false,
      taxClassificationRequiresValidation: true,
    }),
  );
} catch (error) {
  console.error(
    error instanceof Stripe.errors.StripeError
      ? `Stripe ${error.type} (${error.code ?? "error"})`
      : error instanceof Error
        ? error.message
        : "Configuration échouée",
  );
  process.exitCode = 1;
}
