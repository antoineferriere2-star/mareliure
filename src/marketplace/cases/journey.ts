/**
 * Le parcours d'un livre, tel que son propriétaire le suit.
 *
 * Dix étapes sont déclarées ; trois restent invisibles tant que leur brique
 * n'existe pas — l'envoi à l'atelier, le retour et la livraison. On n'affiche
 * jamais une étape indisponible : annoncer « Envoyé » à quelqu'un dont le livre
 * ne peut pas encore voyager par Ma Reliure, c'est promettre un service qui
 * n'existe pas. Le jour où l'expédition arrive, on bascule un booléen.
 *
 * Chaque étape est faite, en cours ou à venir. Pas de pourcentage : on raconte
 * où en est un livre, on ne remplit pas une barre.
 *
 * Le rattachement d'une étape à un statut vit ici, pas dans la page : c'est
 * une règle du domaine, pas une affaire de mise en page.
 */
import { type CaseStatus } from "./state";

export type JourneyStageId =
  | "project"
  | "estimate"
  | "workshop"
  | "order"
  | "travel"
  | "received"
  | "work"
  | "finished"
  | "return"
  | "delivered";

export interface JourneyStage {
  id: JourneyStageId;
  title: string;
  /** Ce que le client comprend de cette étape quand elle est franchie. */
  reached: string;
  /** Ce qu'il lit quand elle est encore devant lui. */
  upcoming: string;
  /**
   * `false` tant que la brique produit n'existe pas. Une étape indisponible
   * n'est jamais rendue, quel que soit l'état du dossier.
   */
  available: boolean;
  /** Les statuts à partir desquels l'étape est franchie. */
  reachedFrom: readonly CaseStatus[];
  /** Les statuts pendant lesquels c'est l'étape en cours. */
  activeWhile: readonly CaseStatus[];
}

/** L'ordre du chemin nominal, annulation exclue. */
const ORDER: readonly CaseStatus[] = [
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
  "work_finished",
  "shipping_to_customer",
  "delivered",
  "completed",
];

const from = (status: CaseStatus) => ORDER.slice(ORDER.indexOf(status));

export const CASE_JOURNEY: readonly JourneyStage[] = [
  {
    id: "project",
    title: "Projet étudié",
    reached: "Ma Reliure a étudié votre livre, vos photos et ce que vous souhaitez en faire.",
    upcoming: "Ma Reliure étudie votre livre et ce que vous souhaitez en faire.",
    available: true,
    reachedFrom: from("pricing"),
    activeWhile: ["under_review"],
  },
  {
    id: "estimate",
    title: "Prix validé",
    reached: "Ma Reliure a fixé le prix de votre projet.",
    upcoming: "Ma Reliure prépare le prix du travail à réaliser.",
    available: true,
    reachedFrom: from("matching"),
    activeWhile: ["pricing"],
  },
  {
    id: "workshop",
    title: "Atelier retenu",
    reached: "L'atelier dont le savoir-faire correspond à votre livre a accepté le projet.",
    upcoming: "Nous choisissons l'atelier dont le savoir-faire correspond à votre livre.",
    available: true,
    reachedFrom: from("binder_selected"),
    activeWhile: ["matching", "awaiting_binder_response", "binder_accepted"],
  },
  {
    id: "order",
    title: "Commande confirmée",
    reached: "Ma Reliure a confirmé votre commande.",
    upcoming: "Ma Reliure confirme votre commande.",
    available: true,
    reachedFrom: from("paid"),
    activeWhile: ["binder_selected", "awaiting_payment"],
  },
  {
    id: "travel",
    title: "Envoyé à l'atelier",
    reached: "Votre livre a voyagé jusqu'à l'atelier.",
    upcoming: "Ma Reliure organisera l'acheminement de votre livre.",
    // Aucune expédition n'existe : ni table, ni transporteur.
    available: false,
    reachedFrom: from("received_by_binder"),
    activeWhile: ["shipping_to_binder"],
  },
  {
    id: "received",
    title: "Reçu à l'atelier",
    reached: "L'atelier a bien reçu votre livre.",
    upcoming: "Votre livre est attendu à l'atelier.",
    available: true,
    reachedFrom: from("received_by_binder"),
    activeWhile: ["paid", "shipping_to_binder"],
  },
  {
    id: "work",
    title: "Travail en cours",
    reached: "L'atelier a réalisé le travail commandé.",
    upcoming: "L'atelier réalisera le travail commandé.",
    available: true,
    reachedFrom: from("work_finished"),
    activeWhile: ["received_by_binder", "in_progress", "awaiting_approval"],
  },
  {
    id: "finished",
    title: "Travail terminé",
    reached: "Votre livre est terminé.",
    upcoming: "Vous serez prévenu dès que votre livre sera terminé.",
    available: true,
    reachedFrom: from("shipping_to_customer"),
    activeWhile: ["work_finished"],
  },
  {
    id: "return",
    title: "Retour",
    reached: "Votre livre a voyagé jusqu'à vous.",
    upcoming: "Ma Reliure organisera le retour de votre livre.",
    // Pas d'expédition retour construite.
    available: false,
    reachedFrom: from("delivered"),
    activeWhile: ["shipping_to_customer"],
  },
  {
    id: "delivered",
    title: "Livré",
    reached: "Votre livre vous a été rendu.",
    upcoming: "Votre livre vous sera rendu.",
    available: false,
    reachedFrom: ["delivered", "completed"],
    activeWhile: [],
  },
];

export type JourneyState = "done" | "current" | "upcoming";

/** Les étapes qu'un client peut voir aujourd'hui, dans l'ordre du parcours. */
export function visibleJourney(
  status: string,
): (JourneyStage & { state: JourneyState; done: boolean })[] {
  return CASE_JOURNEY.filter((stage) => stage.available).map((stage) => {
    const state: JourneyState = (stage.activeWhile as readonly string[]).includes(status)
      ? "current"
      : (stage.reachedFrom as readonly string[]).includes(status)
        ? "done"
        : "upcoming";
    return { ...stage, state, done: state === "done" };
  });
}
