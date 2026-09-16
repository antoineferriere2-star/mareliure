/**
 * Le garde-fou "expected account" (§1 du brief du 16 septembre 2026,
 * migration vers acct_1UGI34K0Q47WbZPf) — pur, testable sans Stripe ni
 * réseau. `stripeClient.server.ts` appelle ceci après avoir lu le compte
 * réellement associé à `STRIPE_SECRET_KEY` ; ce module ne fait que
 * comparer, jamais l'appel réseau lui-même.
 *
 * Fail closed : une clé absente vaut un mismatch, jamais un laissez-passer.
 * Le message ne doit jamais porter l'un ou l'autre identifiant de compte
 * dans un contexte qui pourrait finir loggé publiquement — voir
 * `describeAccountMismatch`, qui ne renvoie qu'un texte générique.
 */
export interface StripeAccountCheck {
  expectedAccountId: string | null;
  actualAccountId: string;
}

export type StripeAccountVerdict = { ok: true } | { ok: false; reason: "not_configured" | "mismatch" };

export function verifyStripeAccount(input: StripeAccountCheck): StripeAccountVerdict {
  if (!input.expectedAccountId) return { ok: false, reason: "not_configured" };
  if (input.actualAccountId !== input.expectedAccountId) return { ok: false, reason: "mismatch" };
  return { ok: true };
}

/**
 * Le seul texte qui doit atteindre un log ou une erreur remontée à
 * l'appelant — jamais les deux identifiants eux-mêmes côte à côte, pour ne
 * jamais révéler par accident lequel des deux comptes réels a répondu.
 */
export function describeAccountMismatch(): string {
  return "Unexpected Stripe account";
}
