/**
 * État d'onboarding d'un atelier, lu par l'admin : abonnement (B) et paiement en ligne (C).
 *
 * Calcul pur sur les colonnes déjà synchronisées depuis Stripe (`marketplace_binders` pour Connect,
 * `marketplace_binder_subscriptions` pour l'abonnement) : Stripe reste la source de vérité, l'admin
 * n'affiche qu'une copie de lecture.
 */

export type SubscriptionState = "legacy_free" | "active" | "cancelling" | "late" | "pending" | "canceled" | "none";
export type OnlinePaymentState = "active" | "payouts_pending" | "in_progress" | "consent_only" | "not_started";

export interface WorkshopOnboardingInput {
  subscription: { status: string; legacy_free: boolean; cancel_at_period_end: boolean | null } | null;
  stripeAccountId: string | null;
  chargesEnabled: boolean | null;
  payoutsEnabled: boolean | null;
  hasConnectConsent: boolean;
}

export interface WorkshopOnboarding { subscription: SubscriptionState; onlinePayment: OnlinePaymentState }

export function workshopOnboarding(input: WorkshopOnboardingInput): WorkshopOnboarding {
  const sub = input.subscription;
  let subscription: SubscriptionState = "none";
  if (sub?.legacy_free) subscription = "legacy_free";
  else if (sub && ["active", "trialing"].includes(sub.status)) subscription = sub.cancel_at_period_end ? "cancelling" : "active";
  else if (sub && ["past_due", "unpaid"].includes(sub.status)) subscription = "late";
  else if (sub && ["incomplete", "paused"].includes(sub.status)) subscription = "pending";
  else if (sub && ["canceled", "incomplete_expired"].includes(sub.status)) subscription = "canceled";

  let onlinePayment: OnlinePaymentState = "not_started";
  if (input.chargesEnabled) onlinePayment = input.payoutsEnabled ? "active" : "payouts_pending";
  else if (input.stripeAccountId) onlinePayment = "in_progress";
  else if (input.hasConnectConsent) onlinePayment = "consent_only";

  return { subscription, onlinePayment };
}

export const SUBSCRIPTION_LABELS: Record<SubscriptionState, string> = {
  legacy_free: "Gratuit (historique)",
  active: "Abonné",
  cancelling: "Résiliation programmée",
  late: "Impayé",
  pending: "Souscription en cours",
  canceled: "Résilié",
  none: "Sans abonnement",
};

export const ONLINE_PAYMENT_LABELS: Record<OnlinePaymentState, string> = {
  active: "Paiement en ligne actif",
  payouts_pending: "Encaissement actif, virements en attente",
  in_progress: "Onboarding Stripe en cours",
  consent_only: "Conditions acceptées, Stripe non commencé",
  not_started: "Paiement en ligne non activé",
};

/** Tonalité d'affichage : ce qui demande une action est mis en avant. */
export function onboardingTone(state: SubscriptionState | OnlinePaymentState): "ok" | "attention" | "neutral" {
  if (state === "late" || state === "payouts_pending") return "attention";
  if (state === "active" || state === "legacy_free") return "ok";
  return "neutral";
}
