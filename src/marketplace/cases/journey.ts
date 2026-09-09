/**
 * Le parcours d'un livre, tel que son propriétaire le suit.
 *
 * Cinq étapes sont prévues. Trois existent aujourd'hui ; deux attendent le
 * paiement et l'expédition, qui ne sont pas construits.
 *
 * Elles sont toutes déclarées ici et non seulement les trois disponibles,
 * parce que la question n'est pas « qu'affiche-t-on » mais « quel est le
 * parcours » : le jour où l'expédition arrive, on bascule un booléen au lieu
 * de retrouver où insérer une étape. Et surtout, on n'affiche jamais une
 * étape indisponible — annoncer « Le voyage de votre livre » à quelqu'un qui
 * ne peut ni payer ni expédier, c'est promettre un service qui n'existe pas.
 *
 * Le rattachement d'une étape à un statut vit ici, pas dans la page : c'est
 * une règle du domaine, pas une affaire de mise en page.
 */
import { type CaseStatus } from "./state";

export interface JourneyStage {
  id: "project" | "estimate" | "workshop" | "order" | "travel";
  title: string;
  /** Ce que le client comprend de cette étape quand elle est atteinte. */
  reached: string;
  /** Ce qu'il lit quand elle est encore devant lui. */
  upcoming: string;
  /**
   * `false` tant que la brique produit n'existe pas. Une étape indisponible
   * n'est jamais rendue, quel que soit l'état du dossier.
   */
  available: boolean;
  /** Les statuts à partir desquels l'étape est considérée atteinte. */
  reachedFrom: readonly CaseStatus[];
}

export const CASE_JOURNEY: readonly JourneyStage[] = [
  {
    id: "project",
    title: "Votre projet",
    reached: "Nous avons votre livre, vos photos et ce que vous souhaitez en faire.",
    upcoming: "Présentez votre livre pour commencer.",
    available: true,
    reachedFrom: [
      "under_review",
      "pricing",
      "matching",
      "awaiting_binder_response",
      "binder_accepted",
      "binder_selected",
      "awaiting_payment",
      "paid",
      "shipping_to_binder",
      "received_by_binder",
      "in_progress",
      "awaiting_approval",
      "shipping_to_customer",
      "delivered",
      "completed",
    ],
  },
  {
    id: "estimate",
    title: "Votre estimation",
    reached: "Ma Reliure a étudié le travail et fixé le prix de votre projet.",
    upcoming: "Ma Reliure étudie le travail à réaliser et prépare votre prix.",
    available: true,
    reachedFrom: [
      "matching",
      "awaiting_binder_response",
      "binder_accepted",
      "binder_selected",
      "awaiting_payment",
      "paid",
      "shipping_to_binder",
      "received_by_binder",
      "in_progress",
      "awaiting_approval",
      "shipping_to_customer",
      "delivered",
      "completed",
    ],
  },
  {
    id: "workshop",
    title: "Votre atelier",
    reached: "L'atelier retenu a accepté le projet et sa rémunération.",
    upcoming: "Nous cherchons l'atelier dont le savoir-faire correspond à votre livre.",
    available: true,
    reachedFrom: [
      "binder_selected",
      "awaiting_payment",
      "paid",
      "shipping_to_binder",
      "received_by_binder",
      "in_progress",
      "awaiting_approval",
      "shipping_to_customer",
      "delivered",
      "completed",
    ],
  },
  {
    id: "order",
    title: "Votre commande",
    reached: "Votre paiement est enregistré.",
    upcoming: "Le règlement se fera auprès de Ma Reliure.",
    // Stripe Connect n'est pas construit (§Q du handoff).
    available: false,
    reachedFrom: [
      "paid",
      "shipping_to_binder",
      "received_by_binder",
      "in_progress",
      "awaiting_approval",
      "shipping_to_customer",
      "delivered",
      "completed",
    ],
  },
  {
    id: "travel",
    title: "Le voyage de votre livre",
    reached: "Votre livre est en route.",
    upcoming: "Ma Reliure organisera son acheminement aller et retour.",
    // Aucune expédition n'existe : ni table, ni fournisseur.
    available: false,
    reachedFrom: [
      "shipping_to_binder",
      "received_by_binder",
      "in_progress",
      "awaiting_approval",
      "shipping_to_customer",
      "delivered",
      "completed",
    ],
  },
];

/** Les étapes qu'un client peut voir aujourd'hui, dans l'ordre du parcours. */
export function visibleJourney(status: string): (JourneyStage & { done: boolean })[] {
  return CASE_JOURNEY.filter((stage) => stage.available).map((stage) => ({
    ...stage,
    done: (stage.reachedFrom as readonly string[]).includes(status),
  }));
}
