/**
 * Le client Stripe de la marketplace — séparé de `src/lib/stripe.server.ts`.
 *
 * Celui-ci parle directement à l'API Stripe avec une vraie clé secrète
 * (`STRIPE_SECRET_KEY`), pas au travers de la passerelle Lovable :
 * `stripe.server.ts` sert l'abonnement SaaS Métré (Customers, Subscriptions,
 * Billing Portal) via des identifiants de connexion opaques que la
 * passerelle traduit — un chemin qui ne porte ni Connect ni Checkout avec
 * `price_data` dynamique par construction. La marketplace a besoin des deux,
 * donc de son propre client.
 *
 * NO SANDBOX (décision explicite de l'utilisateur, 16 septembre 2026) :
 * une seule clé, toujours live. `STRIPE_SECRET_KEY` doit être un secret du
 * Worker Cloudflare (`npx wrangler secret put STRIPE_SECRET_KEY --name
 * mareliure`), jamais commité, jamais dans `.env` versionné.
 *
 * Compte dédié depuis le 16 septembre 2026 (soirée) : `acct_1UGI34K0Q47WbZPf`,
 * créé spécifiquement pour Ma Reliure/Fine Bindery — remplace
 * `acct_1S530YKEMCwyPCrw` (compte historique partagé avec Métré/AccessBot/
 * BatiScores/MuWo/Securicom, voir CODEX_HANDOFF.md), qui ne doit plus
 * recevoir aucun nouvel objet marketplace. `assertExpectedStripeAccount`
 * refuse de servir le client si la clé posée ne correspond pas à
 * `STRIPE_EXPECTED_ACCOUNT_ID` — fail closed, jamais "on fait au mieux"
 * avec la mauvaise clé.
 */
import Stripe from "stripe";
import { verifyStripeAccount, describeAccountMismatch } from "./stripeAccountGuard";

let cached: Stripe | null = null;
let accountVerified = false;

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

/**
 * À appeler avant toute écriture réelle (Checkout, Invoice, Refund,
 * Connected Account, Transfer) — jamais avant une simple lecture
 * administrative. Mémorisé pour la durée de vie de l'isolate : un
 * Checkout qui suit de près n'a pas besoin de rappeler `/v1/account`.
 */
export async function assertExpectedStripeAccount(): Promise<void> {
  if (accountVerified) return;
  const expectedAccountId = process.env.STRIPE_EXPECTED_ACCOUNT_ID ?? null;
  const stripe = getMarketplaceStripeClient();
  const account = await stripe.accounts.retrieveCurrent();
  const verdict = verifyStripeAccount({ expectedAccountId, actualAccountId: account.id });
  if (!verdict.ok) {
    const { logOperationalError } = await import("@/build/services/operationalLog.server");
    // Les identifiants de compte Stripe ne sont pas des secrets (visibles
    // dans le dashboard, déjà partagés par l'utilisateur) — seule la clé
    // API ne doit jamais apparaître ici, et elle n'y apparaît pas.
    logOperationalError(
      "stripe-account-guard.mismatch",
      new Error(describeAccountMismatch()),
      { reason: verdict.reason, expectedAccountId, actualAccountId: account.id },
    );
    throw new Error(describeAccountMismatch());
  }
  accountVerified = true;
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
