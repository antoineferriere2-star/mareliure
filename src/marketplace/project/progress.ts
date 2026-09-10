/**
 * Où en est le livre, dit à chacun dans ses mots, et qui peut le faire avancer.
 *
 * Le statut métier reste celui de `cases/state.ts`. Ce module ne crée pas de
 * nouvel état : il traduit, pour le client et pour l'atelier, ce que ce
 * statut veut dire maintenant, et il déclare qui a le droit de passer à
 * l'étape suivante. « En attente du client » n'est pas un statut : c'est une
 * décision ouverte pendant un travail en cours.
 */
import type { CaseStatus } from "@/marketplace/cases/state";

export interface StatusText {
  headline: string;
  detail: string;
}

const STUDY: readonly string[] = ["under_review", "pricing", "sent_to_binders", "quotes_received"];
const MATCHING: readonly string[] = ["matching", "awaiting_binder_response", "binder_accepted"];
const DONE: readonly string[] = ["delivered", "completed", "cancelled"];

export function customerStatusText(status: string): StatusText {
  switch (status) {
    case "under_review":
    case "pricing":
      return {
        headline: "Ma Reliure étudie votre projet",
        detail: "Nous regardons le travail à faire avant de vous présenter son prix.",
      };
    case "matching":
    case "awaiting_binder_response":
    case "binder_accepted":
      return {
        headline: "Nous choisissons votre atelier",
        detail:
          "Nous vérifions la disponibilité de l'atelier dont le savoir-faire correspond à votre livre.",
      };
    case "binder_selected":
    case "awaiting_payment":
      return {
        headline: "Votre atelier est choisi",
        detail: "Ma Reliure confirme votre commande avant l'arrivée de votre livre à l'atelier.",
      };
    case "paid":
    case "shipping_to_binder":
      return {
        headline: "Votre commande est confirmée",
        detail: "Votre livre est attendu à l'atelier.",
      };
    case "received_by_binder":
      return {
        headline: "Votre livre est à l'atelier",
        detail: "L'atelier a bien reçu votre livre et va commencer le travail.",
      };
    case "in_progress":
    case "awaiting_approval":
      return {
        headline: "Votre livre est à l'atelier",
        detail: "L'atelier travaille actuellement sur votre livre.",
      };
    case "work_finished":
      return {
        headline: "Votre livre est terminé",
        detail: "Nous préparons son retour.",
      };
    case "shipping_to_customer":
      return { headline: "Votre livre revient vers vous", detail: "Il est en route." };
    case "delivered":
    case "completed":
      return {
        headline: "Votre livre vous a été rendu",
        detail: "Son dossier reste ici, avec ses photos, vos choix et vos échanges avec l'atelier.",
      };
    case "cancelled":
      return { headline: "Projet annulé", detail: "Ce projet n'a pas été poursuivi." };
    default:
      return {
        headline: "Votre projet avance",
        detail: "Ma Reliure vous tient informé à chaque étape.",
      };
  }
}

export type CustomerGroup = "action" | "in_progress" | "study" | "done";

/** Où ranger une carte dans « Mes livres ». L'action attendue passe avant tout. */
export function customerGroup(status: string, actionRequired: boolean): CustomerGroup {
  if (DONE.includes(status)) return "done";
  if (actionRequired) return "action";
  if (STUDY.includes(status) || MATCHING.includes(status)) return "study";
  return "in_progress";
}

export type BinderGroup = "proposals" | "in_progress" | "waiting_customer" | "done" | "closed";

const LIVE_OFFER: readonly string[] = ["offered", "invited", "quoted", "accepted"];

/** Où ranger une carte dans le tableau de l'atelier. */
export function binderGroup(input: {
  offerState: string;
  caseStatus: string;
  openDecisions: number;
}): BinderGroup {
  if (input.offerState !== "selected")
    return LIVE_OFFER.includes(input.offerState) ? "proposals" : "closed";
  if (DONE.includes(input.caseStatus)) return "done";
  if (input.openDecisions > 0) return "waiting_customer";
  return "in_progress";
}

/** La prochaine chose à faire, du point de vue de l'atelier retenu. */
export function binderNextAction(caseStatus: string, openDecisions: number): string {
  switch (caseStatus) {
    case "binder_selected":
    case "awaiting_payment":
      return "Commande en cours de confirmation par Ma Reliure";
    case "paid":
    case "shipping_to_binder":
      return "Confirmer la réception du livre";
    case "received_by_binder":
      return "Commencer le travail";
    case "in_progress":
    case "awaiting_approval":
      return openDecisions > 0 ? "En attente de la réponse du client" : "Travail en cours";
    case "work_finished":
      return "Retour en préparation par Ma Reliure";
    case "delivered":
    case "completed":
      return "Terminé";
    case "cancelled":
      return "Projet annulé";
    default:
      return "Projet en cours";
  }
}

export type ProgressActor = "admin" | "binder";

/**
 * Qui fait avancer quoi.
 *
 * Deux passages provisoires, décidés le 10 septembre 2026 faute de paiement
 * et d'expédition construits : Ma Reliure confirme la commande à la main
 * (`paid`, règlement reçu par Ma Reliure), et l'atelier confirme la réception
 * sans étape de transport. Le jour où ces briques existent, ces lignes
 * disparaissent et la machine à états reprend son chemin complet.
 */
export const PROGRESS_STEPS: readonly {
  to: CaseStatus;
  from: readonly CaseStatus[];
  actor: ProgressActor;
  label: string;
  event: "order_confirmed" | "book_received" | "work_started" | "work_finished";
}[] = [
  {
    to: "paid",
    from: ["binder_selected", "awaiting_payment"],
    actor: "admin",
    label: "Confirmer la commande",
    event: "order_confirmed",
  },
  {
    to: "received_by_binder",
    from: ["paid", "shipping_to_binder"],
    actor: "binder",
    label: "Confirmer la réception",
    event: "book_received",
  },
  {
    to: "in_progress",
    from: ["received_by_binder"],
    actor: "binder",
    label: "Commencer le travail",
    event: "work_started",
  },
  {
    to: "work_finished",
    from: ["in_progress", "awaiting_approval"],
    actor: "binder",
    label: "Travail terminé",
    event: "work_finished",
  },
];

export function progressStepsFor(actor: ProgressActor, caseStatus: string) {
  return PROGRESS_STEPS.filter(
    (step) => step.actor === actor && (step.from as readonly string[]).includes(caseStatus),
  );
}

export function progressStep(actor: ProgressActor, from: string, to: string) {
  return (
    PROGRESS_STEPS.find(
      (step) =>
        step.actor === actor && step.to === to && (step.from as readonly string[]).includes(from),
    ) ?? null
  );
}
