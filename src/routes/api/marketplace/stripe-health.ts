/**
 * Vérifie que `STRIPE_SECRET_KEY` (Worker `mareliure`) répond bien pour le
 * compte attendu (`STRIPE_EXPECTED_ACCOUNT_ID`) — le même garde-fou que
 * `assertExpectedStripeAccount`, déclenché à la demande plutôt qu'au premier
 * appel Stripe réel. Utile après chaque pose/rotation de clé, pas seulement
 * cette fois-ci.
 *
 * Protégé par jeton porteur (même discipline que
 * `api/internal/analytics/metrics.ts`) — jamais public, jamais de secret
 * dans la réponse : seulement l'ID de compte (pas sensible) et un
 * booléen.
 */
import { createFileRoute } from "@tanstack/react-router";
import { assertExpectedStripeAccount } from "@/marketplace/stripe/stripeClient.server";

function bearerToken(request: Request): string | null {
  const h = request.headers.get("Authorization") ?? request.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m?.[1] ?? null;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export async function handleStripeHealth(request: Request): Promise<Response> {
  const token = process.env.STRIPE_HEALTHCHECK_TOKEN;
  if (!token) return json(404, { error: "Not found" });
  if (bearerToken(request) !== token) return json(401, { error: "Unauthorized" });

  try {
    await assertExpectedStripeAccount();
    return json(200, { ok: true, expectedAccountId: process.env.STRIPE_EXPECTED_ACCOUNT_ID ?? null });
  } catch (err) {
    return json(200, {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      expectedAccountId: process.env.STRIPE_EXPECTED_ACCOUNT_ID ?? null,
    });
  }
}

export const Route = createFileRoute("/api/marketplace/stripe-health")({
  server: { handlers: { GET: async ({ request }) => handleStripeHealth(request) } },
});
