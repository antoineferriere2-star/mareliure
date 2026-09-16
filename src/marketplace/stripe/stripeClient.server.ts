/**
 * Le client Stripe de la marketplace — séparé de `src/lib/stripe.server.ts`.
 *
 * Celui-ci parle directement à l'API Stripe avec une vraie clé secrète
 * (`STRIPE_SECRET_KEY`), pas au travers de la passerelle Lovable :
 * `stripe.server.ts` sert l'abonnement SaaS Métré (Customers, Subscriptions,
 * Billing Portal) via des identifiants de connexion opaques que la
 * passerelle traduit — un chemin qui ne porte ni Connect ni Checkout avec
 * `price_data` dynamique par construction. La marketplace a besoin des deux,
 * donc de son propre client, sur le même compte Stripe live
 * (`acct_1S530YKEMCwyPCrw`) qui sert déjà Métré/AccessBot/BatiScores/MuWo —
 * voir l'audit du 16 septembre 2026 dans CODEX_HANDOFF.md.
 *
 * NO SANDBOX (décision explicite de l'utilisateur, 16 septembre 2026) :
 * une seule clé, toujours live. `STRIPE_SECRET_KEY` doit être un secret du
 * Worker Cloudflare (`npx wrangler secret put STRIPE_SECRET_KEY --name
 * mareliure`), jamais commité, jamais dans `.env` versionné.
 */
import Stripe from "stripe";

let cached: Stripe | null = null;

export function getMarketplaceStripeClient(): Stripe {
  if (cached) return cached;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY manquant — secret du Worker Cloudflare, jamais dans .env versionné.",
    );
  }
  cached = new Stripe(secretKey, { apiVersion: "2026-06-24.dahlia" });
  return cached;
}

export function getMarketplaceStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET manquant — secret du Worker Cloudflare, jamais dans .env versionné.",
    );
  }
  return secret;
}
