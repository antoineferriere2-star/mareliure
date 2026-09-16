/**
 * Setup idempotent des trois Products Stripe permanents de la marketplace
 * (§5-8 du brief du 16 septembre 2026) : Ma Reliure Service, Fine Bindery
 * Service, Transport/Shipping.
 *
 * Retrouve chaque Product par sa metadata stable (`brand`/`product_role`)
 * avant d'en créer un — ne crée jamais de doublon, y compris si les trois
 * Products ont déjà été créés une fois via le connecteur MCP (constaté :
 * prod_VGowujXB5VAtLN, prod_VGoxLIJgDWDx7c, prod_VGoxkLqYmwcFm6, créés le
 * 16 septembre 2026). NO SANDBOX — toujours le compte live
 * acct_1S530YKEMCwyPCrw, décision explicite de l'utilisateur.
 *
 * Run avec : npx tsx scripts/setupStripeProducts.ts
 *
 * Affiche les trois variables d'environnement à reporter dans les secrets
 * du Worker Cloudflare (`npx wrangler secret put <NOM> --name mareliure`) —
 * ne les écrit dans aucun fichier.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";

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

interface Wanted {
  envVar: string;
  name: string;
  metadata: Record<string, string>;
}

const WANTED: Wanted[] = [
  {
    envVar: "STRIPE_PRODUCT_MA_RELIURE_SERVICE",
    name: "Ma Reliure — Service de reliure et restauration",
    metadata: { product_role: "CUSTOMER_SERVICE", brand: "MA_RELIURE" },
  },
  {
    envVar: "STRIPE_PRODUCT_FINE_BINDERY_SERVICE",
    name: "Fine Bindery — Exceptional French Bookbinding",
    metadata: { product_role: "CUSTOMER_SERVICE", brand: "FINE_BINDERY" },
  },
  {
    envVar: "STRIPE_PRODUCT_SHIPPING",
    name: "Transport / Shipping",
    metadata: { product_role: "SHIPPING" },
  },
];

function matchesMetadata(product: Stripe.Product, metadata: Record<string, string>): boolean {
  return Object.entries(metadata).every(([key, value]) => product.metadata[key] === value);
}

async function findExisting(stripe: Stripe, metadata: Record<string, string>) {
  // La recherche côté serveur est indexée avec un léger délai après une
  // écriture — on relit donc `list` (cohérence immédiate) et on filtre en
  // mémoire par metadata, plutôt que `products.search` qui peut manquer un
  // Product créé à l'instant.
  let startingAfter: string | undefined;
  for (;;) {
    const page = await stripe.products.list({ limit: 100, starting_after: startingAfter });
    const found = page.data.find((product) => matchesMetadata(product, metadata));
    if (found) return found;
    if (!page.has_more) return null;
    startingAfter = page.data[page.data.length - 1]?.id;
  }
}

async function main() {
  loadDotEnv();
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY manquant dans l'environnement — voir .env.example.");
  }
  const stripe = new Stripe(secretKey, { apiVersion: "2026-06-24.dahlia" });

  console.log("[setupStripeProducts] compte live acct_1S530YKEMCwyPCrw — NO SANDBOX.");

  const resolved: Record<string, string> = {};
  for (const wanted of WANTED) {
    const existing = await findExisting(stripe, wanted.metadata);
    if (existing) {
      console.log(`[setupStripeProducts] réutilise ${wanted.name} → ${existing.id}`);
      resolved[wanted.envVar] = existing.id;
      continue;
    }
    const created = await stripe.products.create({
      name: wanted.name,
      type: "service",
      metadata: wanted.metadata,
    });
    console.log(`[setupStripeProducts] créé ${wanted.name} → ${created.id}`);
    resolved[wanted.envVar] = created.id;
  }

  console.log("\n[setupStripeProducts] à reporter comme secrets du Worker Cloudflare :");
  for (const [envVar, id] of Object.entries(resolved)) {
    console.log(`  ${envVar}=${id}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
