/**
 * Ce que le client lit de son projet — jamais un statut technique.
 *
 * Tout ici est de la présentation pure : aucune règle métier, aucun accès aux
 * données, aucune décision de sécurité. Les faits (statut, prix validé,
 * proposition acceptée, paiement possible, paiement effectué, décision en
 * attente) viennent du serveur, qui reste seul juge de ce qui est payable —
 * ce module ne fait que les traduire en mots qu'un client comprend, dans la
 * langue de sa marque.
 *
 * Un seul endroit, pour que la liste, le détail et les tests disent la même
 * chose : un statut renommé ici l'est partout.
 */
import { BOOKBINDING_PUBLIC_TOKEN, FINE_BINDERY_PUBLIC_TOKEN } from "@/build/constants";

export type CustomerLocale = "fr-FR" | "en-US";

/** Les faits, déjà calculés côté serveur, dont dépend ce que le client lit. */
export interface CustomerCaseFacts {
  /** `marketplace_cases.status` — opaque ici : jamais affiché tel quel. */
  status: string;
  /** Un prix a été validé par un humain pour ce projet. */
  hasPrice: boolean;
  /** Une proposition commerciale acceptée existe. */
  proposalAccepted: boolean;
  /** Le serveur affirme que le client peut, maintenant, accepter la proposition qu'on lui présente. */
  proposalAcceptable: boolean;
  /** Le serveur affirme que le paiement peut démarrer (checkoutEligibility). */
  paymentEligible: boolean;
  /** Le paiement est enregistré. */
  paid: boolean;
  /** Une décision attend la réponse du client. */
  actionRequired: boolean;
}

export const CUSTOMER_STATUS_KEYS = [
  "received",
  "reviewing",
  "proposal_ready",
  "awaiting_you",
  "payment_due",
  "paid",
  "workshop_selected",
  "in_progress",
  "needs_approval",
  "travelling",
  "returning",
  "delivered",
  "completed",
  "cancelled",
] as const;
export type CustomerStatusKey = (typeof CUSTOMER_STATUS_KEYS)[number];

/** Ton visuel d'un statut — pas de couleur ici, seulement l'intention. */
export type CustomerStatusTone = "neutral" | "action" | "progress" | "done" | "muted";

const STATUS_LABELS: Record<CustomerLocale, Record<CustomerStatusKey, string>> = {
  "fr-FR": {
    received: "Dossier reçu",
    reviewing: "Projet en cours d'étude",
    proposal_ready: "Proposition disponible",
    awaiting_you: "En attente de votre confirmation",
    payment_due: "Paiement attendu",
    paid: "Paiement confirmé",
    workshop_selected: "Atelier sélectionné",
    in_progress: "Travail en cours",
    needs_approval: "En attente de votre validation",
    travelling: "Livre en route vers l'atelier",
    returning: "Retour en préparation",
    delivered: "Livré",
    completed: "Terminé",
    cancelled: "Annulé",
  },
  "en-US": {
    received: "Project received",
    reviewing: "Under review",
    proposal_ready: "Proposal ready",
    awaiting_you: "Awaiting your confirmation",
    payment_due: "Payment due",
    paid: "Payment confirmed",
    workshop_selected: "Workshop selected",
    in_progress: "Work in progress",
    needs_approval: "Awaiting your approval",
    travelling: "Book on its way to the workshop",
    returning: "Preparing its return",
    delivered: "Delivered",
    completed: "Completed",
    cancelled: "Cancelled",
  },
};

const STATUS_TONES: Record<CustomerStatusKey, CustomerStatusTone> = {
  received: "neutral",
  reviewing: "progress",
  proposal_ready: "neutral",
  awaiting_you: "action",
  payment_due: "action",
  paid: "done",
  workshop_selected: "progress",
  in_progress: "progress",
  needs_approval: "action",
  travelling: "progress",
  returning: "progress",
  delivered: "done",
  completed: "done",
  cancelled: "muted",
};

export interface CustomerStatus {
  key: CustomerStatusKey;
  label: string;
  tone: CustomerStatusTone;
}

/**
 * Le statut que voit le client. L'ordre des tests est l'histoire du dossier,
 * du plus avancé au plus récent : un projet payé n'est plus « en attente »,
 * quelle que soit la valeur brute de son statut.
 */
export function customerStatusKey(facts: CustomerCaseFacts): CustomerStatusKey {
  const { status } = facts;
  if (status === "cancelled") return "cancelled";
  if (status === "completed") return "completed";
  if (status === "delivered") return "delivered";
  // Une confirmation attendue du client prime sur tout état non terminal : même
  // payé, un projet qui attend une réponse est d'abord « en attente de vous ».
  if (facts.actionRequired) return "awaiting_you";
  if (status === "shipping_to_customer") return "returning";
  if (status === "awaiting_approval") return "needs_approval";
  if (status === "in_progress" || status === "received_by_binder") return "in_progress";
  if (status === "shipping_to_binder") return "travelling";
  if (facts.paid || status === "paid") return "paid";
  if (facts.paymentEligible) return "payment_due";
  if (status === "binder_selected" || status === "awaiting_payment") return "workshop_selected";
  if (facts.hasPrice || facts.proposalAccepted) return "proposal_ready";
  if (status === "under_review") return "received";
  // `pricing`, `matching`, `awaiting_binder_response`, `binder_accepted`, et tout
  // statut que le domaine ajouterait un jour : le client lit « à l'étude »,
  // jamais la valeur brute.
  return "reviewing";
}

export function customerStatus(facts: CustomerCaseFacts, locale: CustomerLocale): CustomerStatus {
  const key = customerStatusKey(facts);
  // Une proposition qui attend l'acceptation du client est une action, pas une simple info.
  const tone = key === "proposal_ready" && facts.proposalAcceptable ? "action" : STATUS_TONES[key];
  return { key, label: STATUS_LABELS[locale][key], tone };
}

// ---------------------------------------------------------------------------
// Prochaine étape
// ---------------------------------------------------------------------------

/**
 * Ce que le bouton principal de la zone « Prochaine étape » déclenche.
 * `pay` et `accept` ne sont jamais décidés ici : le composant qui les rend
 * appelle la server function correspondante, qui revalide tout côté serveur.
 */
export type NextStepAction = "accept" | "pay" | "decision" | "proposal" | "messages";

export interface NextStep {
  /** Une phrase, à l'indicatif, sans jargon. */
  text: string;
  /** Une précision secondaire (ex. ce qui débloque le paiement). */
  hint: string | null;
  /** `null` : le client n'a rien à faire. */
  action: NextStepAction | null;
  actionLabel: string | null;
  /** Le client doit agir maintenant. */
  requiresAction: boolean;
}

const NO_ACTION_HINT: Record<CustomerLocale, string> = {
  "fr-FR": "Aucune action requise de votre part.",
  "en-US": "Nothing is required from you right now.",
};

interface NextStepCopy {
  text: string;
  hint?: string;
  action?: NextStepAction;
  label?: string;
}

const NEXT_STEP_COPY: Record<CustomerLocale, Record<CustomerStatusKey, NextStepCopy>> = {
  "fr-FR": {
    received: { text: "Nous avons bien reçu votre projet et allons l'examiner." },
    reviewing: { text: "Nous étudions votre projet." },
    proposal_ready: {
      text: "Votre proposition est prête. Consultez-la ci-dessous.",
      action: "proposal",
      label: "Voir ma proposition",
    },
    awaiting_you: {
      text: "Une confirmation vous est demandée pour avancer sur votre livre.",
      action: "decision",
      label: "Répondre",
    },
    payment_due: {
      text: "Votre proposition est acceptée. Votre paiement est attendu pour lancer la prise en charge.",
      action: "pay",
      label: "Payer",
    },
    paid: { text: "Votre paiement est confirmé. Nous organisons la suite avec votre atelier." },
    workshop_selected: { text: "Votre atelier est confirmé. Nous préparons la suite." },
    in_progress: { text: "Votre livre est en cours de traitement." },
    needs_approval: {
      text: "L'atelier attend votre validation pour poursuivre.",
      action: "decision",
      label: "Répondre",
    },
    travelling: { text: "Votre livre est en route vers l'atelier." },
    returning: { text: "Votre livre est prêt à revenir vers vous : nous préparons son retour." },
    delivered: { text: "Votre livre vous a été remis." },
    completed: { text: "Votre projet est terminé. Merci de votre confiance." },
    cancelled: { text: "Ce projet a été annulé." },
  },
  "en-US": {
    received: { text: "We have received your project and will review it shortly." },
    reviewing: { text: "We are reviewing your project." },
    proposal_ready: {
      text: "Your proposal is ready. Review it below.",
      action: "proposal",
      label: "View my proposal",
    },
    awaiting_you: {
      text: "We need a confirmation from you to move forward with your book.",
      action: "decision",
      label: "Reply",
    },
    payment_due: {
      text: "Your proposal is accepted. Payment is now due to begin work.",
      action: "pay",
      label: "Pay securely",
    },
    paid: { text: "Your payment is confirmed. We are arranging the next steps with your workshop." },
    workshop_selected: { text: "Your workshop is confirmed. We are preparing what comes next." },
    in_progress: { text: "Your book is being worked on." },
    needs_approval: {
      text: "We need your approval to continue.",
      action: "decision",
      label: "Reply",
    },
    travelling: { text: "Your book is on its way to the workshop." },
    returning: { text: "Your book is ready to come back to you: we are arranging its return." },
    delivered: { text: "Your book has been delivered." },
    completed: { text: "Your project is complete. Thank you for your trust." },
    cancelled: { text: "This project has been cancelled." },
  },
};

/** « Votre proposition est prête » quand le client peut l'accepter : l'acceptation est son action. */
const ACCEPT_STEP_COPY: Record<CustomerLocale, NextStepCopy> = {
  "fr-FR": {
    text: "Votre proposition est prête. Acceptez-la pour passer au paiement.",
    action: "accept",
    label: "Accepter la proposition",
  },
  "en-US": {
    text: "Your proposal is ready. Accept it to move on to payment.",
    action: "accept",
    label: "Accept proposal",
  },
};

export function customerNextStep(facts: CustomerCaseFacts, locale: CustomerLocale): NextStep {
  const key = customerStatusKey(facts);
  const copy =
    key === "proposal_ready" && facts.proposalAcceptable ? ACCEPT_STEP_COPY[locale] : NEXT_STEP_COPY[locale][key];
  const action = copy.action ?? null;
  return {
    text: copy.text,
    hint: copy.hint ?? (action === null ? NO_ACTION_HINT[locale] : null),
    action,
    actionLabel: copy.label ?? null,
    requiresAction: action !== null && action !== "proposal",
  };
}

// ---------------------------------------------------------------------------
// Tri de la liste
// ---------------------------------------------------------------------------

/** Ce dont le tri a besoin — rien d'autre. */
export interface SortableCustomerRow {
  createdAt: string;
  actionRequired: boolean;
  paymentEligible: boolean;
  proposalAcceptable: boolean;
}

/**
 * Un projet qui attend le client (une réponse, une acceptation, un paiement) passe avant les
 * autres ; à égalité, le plus récent d'abord. « Qu'est-ce que je dois faire
 * maintenant ? » est la première question d'une liste.
 */
export function sortForCustomer<T extends SortableCustomerRow>(rows: readonly T[]): T[] {
  const waiting = (row: T) => (row.actionRequired || row.paymentEligible || row.proposalAcceptable ? 0 : 1);
  return [...rows].sort((a, b) => waiting(a) - waiting(b) || b.createdAt.localeCompare(a.createdAt));
}

// ---------------------------------------------------------------------------
// Mode de prix
// ---------------------------------------------------------------------------

const PRICING_MODE_LABELS: Record<CustomerLocale, Record<string, string>> = {
  "fr-FR": {
    FIXED_PRICE: "Prix ferme",
    ESTIMATE_THEN_CONFIRM: "Estimation avant confirmation",
    MANUAL_STUDY: "Étude personnalisée",
  },
  "en-US": {
    FIXED_PRICE: "Fixed price",
    ESTIMATE_THEN_CONFIRM: "Estimate, confirmed after review",
    MANUAL_STUDY: "Tailored study",
  },
};

/** Le mode de prix en mots, ou `null` si la valeur est inconnue — jamais l'enum brut. */
export function pricingModeLabel(mode: string | null | undefined, locale: CustomerLocale): string | null {
  if (!mode) return null;
  return PRICING_MODE_LABELS[locale][mode] ?? null;
}

// ---------------------------------------------------------------------------
// Historique
// ---------------------------------------------------------------------------

export interface TimelineFacts {
  status: string;
  createdAt: string | null;
  proposalPreparedAt: string | null;
  proposalConfirmedAt: string | null;
  paidAt: string | null;
  workshopSelectedAt: string | null;
}

export interface TimelineEntry {
  key: string;
  label: string;
  /** ISO, ou `null` quand l'étape est atteinte sans date connue du client. */
  at: string | null;
}

const TIMELINE_LABELS: Record<CustomerLocale, Record<string, string>> = {
  "fr-FR": {
    sent: "Projet envoyé",
    proposal_prepared: "Proposition préparée",
    proposal_confirmed: "Proposition confirmée",
    paid: "Paiement confirmé",
    workshop: "Atelier sélectionné",
    work: "Travail commencé",
    returning: "Retour en préparation",
    completed: "Projet terminé",
  },
  "en-US": {
    sent: "Project sent",
    proposal_prepared: "Proposal prepared",
    proposal_confirmed: "Proposal confirmed",
    paid: "Payment confirmed",
    workshop: "Workshop selected",
    work: "Work started",
    returning: "Return being prepared",
    completed: "Project completed",
  },
};

const WORK_STARTED: readonly string[] = [
  "received_by_binder",
  "in_progress",
  "awaiting_approval",
  "shipping_to_customer",
  "delivered",
  "completed",
];
const RETURNING: readonly string[] = ["shipping_to_customer", "delivered", "completed"];

/**
 * L'histoire vue du client : les jalons qu'il reconnaît, construits à partir
 * de dates qu'il a le droit de connaître — jamais les événements internes.
 * Une étape sans date reste affichée dès que son statut est atteint.
 */
export function customerTimeline(facts: TimelineFacts, locale: CustomerLocale): TimelineEntry[] {
  const L = TIMELINE_LABELS[locale];
  const entries: TimelineEntry[] = [];
  if (facts.createdAt) entries.push({ key: "sent", label: L.sent, at: facts.createdAt });
  if (facts.proposalPreparedAt)
    entries.push({ key: "proposal_prepared", label: L.proposal_prepared, at: facts.proposalPreparedAt });
  if (facts.proposalConfirmedAt)
    entries.push({ key: "proposal_confirmed", label: L.proposal_confirmed, at: facts.proposalConfirmedAt });
  if (facts.paidAt) entries.push({ key: "paid", label: L.paid, at: facts.paidAt });
  if (facts.workshopSelectedAt)
    entries.push({ key: "workshop", label: L.workshop, at: facts.workshopSelectedAt });
  if (WORK_STARTED.includes(facts.status)) entries.push({ key: "work", label: L.work, at: null });
  if (RETURNING.includes(facts.status)) entries.push({ key: "returning", label: L.returning, at: null });
  if (facts.status === "completed") entries.push({ key: "completed", label: L.completed, at: null });
  return entries;
}

// ---------------------------------------------------------------------------
// Valeurs du Brief
// ---------------------------------------------------------------------------

/** Ce qu'un champ vide ne doit jamais afficher. */
const EMPTY_MARKERS = new Set(["", "-", "–", "—", "null", "undefined", "n/a", "nan"]);

/** « Nous ne le savons pas encore » : à ne pas présenter comme une donnée. */
const UNKNOWN_MARKERS = new Set([
  "à préciser",
  "a preciser",
  "non précisé",
  "non precise",
  "to clarify",
  "not specified",
  "unknown",
  "je ne sais pas",
  "i'm not sure",
]);

/**
 * `manual_review_required`, `FIXED_PRICE`, `livre_courant` : un identifiant
 * machine, pas une phrase. Volontairement étroit — un seul mot relié par des
 * underscores — pour ne jamais masquer une référence (« RL-006 »), un nombre
 * ou un titre que le client a écrit lui-même.
 */
export function looksLikeRawEnum(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]*(_[A-Za-z0-9]+)+$/.test(value.trim());
}

export function isEmptyValue(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return true;
  return EMPTY_MARKERS.has(value.trim().toLowerCase());
}

export function isUnknownValue(value: string): boolean {
  return UNKNOWN_MARKERS.has(value.trim().toLowerCase());
}

const BOOLEAN_WORDS: Record<CustomerLocale, { yes: string; no: string }> = {
  "fr-FR": { yes: "Oui", no: "Non" },
  "en-US": { yes: "Yes", no: "No" },
};

/** `true`/`false` deviennent Oui/Non ; le reste passe tel quel. */
export function humanizeBoolean(value: string, locale: CustomerLocale): string {
  const v = value.trim().toLowerCase();
  if (v === "true") return BOOLEAN_WORDS[locale].yes;
  if (v === "false") return BOOLEAN_WORDS[locale].no;
  return value;
}

export interface BriefLineLike {
  label: string;
  value: string;
  source?: string;
}

export interface PresentedLines {
  /** Ce que le client a dit ou que nous avons retenu — lignes à afficher. */
  shown: { label: string; value: string; tentative: boolean }[];
  /** Ce que nous devons encore confirmer, en clair. */
  toConfirm: string[];
}

/**
 * Nettoie les lignes d'un Brief pour le client : rien de vide, pas de
 * `true`/`false`, pas d'identifiant brut, et le « on ne sait pas encore »
 * sort de la liste pour devenir une question à confirmer. `tentative` marque
 * une valeur que ni le client ni un humain n'a confirmée (hypothèse d'après
 * photo) — dite « à confirmer », jamais « Hypothèse IA ».
 */
export function presentBriefLines(lines: readonly BriefLineLike[], locale: CustomerLocale): PresentedLines {
  const shown: PresentedLines["shown"] = [];
  const toConfirm: string[] = [];
  for (const line of lines) {
    if (isEmptyValue(line.value) || isEmptyValue(line.label)) continue;
    if (isUnknownValue(line.value)) {
      toConfirm.push(line.label);
      continue;
    }
    if (looksLikeRawEnum(line.value)) continue;
    shown.push({
      label: line.label,
      value: humanizeBoolean(line.value, locale),
      tentative: line.source === "image_hypothesis",
    });
  }
  return { shown, toConfirm };
}

// ---------------------------------------------------------------------------
// Réponses aux décisions
// ---------------------------------------------------------------------------

/**
 * Une réponse de décision est un JSON libre (`{"choice":"Bleu nuit"}`,
 * `{"text":"…"}`, `{"title":"…","author":"…"}`) : le client la relit en mots,
 * jamais en JSON. Les clés techniques ne sont pas affichées, seulement leurs
 * valeurs textuelles, dans l'ordre où elles ont été écrites.
 */
export function humanizeDecisionAnswer(answer: unknown): string {
  if (typeof answer === "string") return answer.trim();
  if (typeof answer === "number" || typeof answer === "boolean") return String(answer);
  if (answer && typeof answer === "object") {
    const record = answer as Record<string, unknown>;
    for (const key of ["choice", "text"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim() !== "") return value.trim();
    }
    return Object.values(record)
      .filter((v): v is string => typeof v === "string" && v.trim() !== "")
      .map((v) => v.trim())
      .join(" · ");
  }
  return "";
}

// ---------------------------------------------------------------------------
// Textes de l'interface
// ---------------------------------------------------------------------------

export interface CustomerCopy {
  brandHome: string;
  myBooks: string;
  backToBooks: string;
  home: string;
  listTitle: string;
  listIntro: string;
  emptyTitle: string;
  emptyBody: string;
  emptyCta: string;
  startProjectHref: string;
  createdOn: (date: string) => string;
  newMessages: (n: number) => string;
  actionRequired: string;
  nextStep: string;
  yourProposal: string;
  proposalService: string;
  proposalShipping: string;
  proposalTotalHt: string;
  proposalVat: (ratePercent: string | null) => string;
  proposalTotalTtc: string;
  proposalPriceKind: string;
  proposalPriceOnly: string;
  proposalEstimate: (range: string) => string;
  proposalIncludes: string;
  proposalNotPayable: string;
  proposalPayAfterAccept: string;
  proposalAcceptedOn: (date: string) => string;
  proposalPaid: string;
  acceptLabel: string;
  acceptBusy: string;
  acceptError: string;
  acceptedNotice: string;
  /** « En acceptant, vous confirmez le total de … » — le total est celui que le serveur a envoyé. */
  acceptSummary: (total: string, taxIncluded: boolean) => string;
  payLabel: string;
  payRedirecting: string;
  payError: string;
  summary: string;
  photos: string;
  photoAlt: (i: number) => string;
  photoUnavailable: string;
  photoOpen: (i: number) => string;
  photoClose: string;
  theProject: string;
  budgetAndTiming: string;
  toConfirmTitle: string;
  tentative: string;
  workshop: string;
  workshopYears: (n: number) => string;
  messages: string;
  messagesEmpty: string;
  messagesPlaceholder: string;
  messagesSend: string;
  messagesSending: string;
  messagesLoad: string;
  messagesError: string;
  messagesSendError: string;
  messageDeleted: string;
  decisions: string;
  decisionsEmpty: string;
  history: string;
  moreDetails: string;
  lessDetails: string;
  location: string;
  contact: string;
  loading: string;
  loadError: string;
  retry: string;
  claimTitle: string;
  claimBody: string;
  claimSummary: string;
  claimButton: string;
  claimBusy: string;
  claimDone: string;
  claimAlready: string;
  claimError: string;
  reference: string;
  openProject: string;
  heritageNote: string;
  manualReviewNote: string;
  decisionConfirm: string;
  decisionConfirming: string;
  decisionError: string;
  decisionConfirmedOn: (date: string | null) => string;
  decisionCancelled: string;
  decisionSuperseded: string;
  decisionAnswerLabel: string;
  decisionAnswerPlaceholder: string;
  decisionGildingPlaceholder: string;
  decisionGildingWarning: string;
  messageAuthorYou: string;
  messageAuthorTeam: string;
  messageAuthorWorkshop: string;
  messagesRetry: string;
  sectionError: string;
  messageCta: string;
  skipToContent: string;
  /** « Se déconnecter » : sans lui, un compte ouvert sur un appareil ne pouvait plus être quitté. */
  signOut: string;
  /** Préfixe accessible de l'adresse affichée à côté du bouton : « Connecté en tant que ». */
  signedInAs: string;
  backNavLabel: string;
  messagesRefreshError: string;
  conciergeTitle: string;
  conciergeIntro: string;
  conciergeEmpty: string;
  conciergePlaceholder: string;
  conciergeAuthor: string;
  conciergeCta: string;
}

const FR: CustomerCopy = {
  brandHome: "Ma Reliure",
  myBooks: "Mes livres",
  backToBooks: "Mes livres",
  home: "Accueil",
  listTitle: "Mes livres",
  listIntro: "Retrouvez ici chacun de vos projets, où il en est et ce qui vous est demandé.",
  emptyTitle: "Aucun projet pour le moment",
  emptyBody: "Présentez un livre pour lancer un premier projet : vous le retrouverez ici, avec son avancement.",
  emptyCta: "Présenter un livre",
  startProjectHref: `/m/${BOOKBINDING_PUBLIC_TOKEN}`,
  createdOn: (d) => `Créé le ${d}`,
  newMessages: (n) => `${n} nouveau${n > 1 ? "x" : ""} message${n > 1 ? "s" : ""}`,
  actionRequired: "Action requise",
  nextStep: "Prochaine étape",
  yourProposal: "Votre proposition",
  proposalService: "Service",
  proposalShipping: "Transport",
  proposalTotalHt: "Total HT",
  proposalVat: (rate) => (rate ? `TVA (${rate})` : "TVA"),
  proposalTotalTtc: "Total TTC",
  proposalPriceKind: "Type de prix",
  proposalPriceOnly: "Prix de votre projet",
  proposalEstimate: (range) => `Estimation : ${range}. Le prix définitif est confirmé après examen du livre par l'atelier.`,
  proposalIncludes: "Comprend",
  proposalNotPayable: "Le paiement sera disponible après validation de votre proposition.",
  proposalPayAfterAccept: "Le paiement sera disponible dès que vous aurez accepté la proposition.",
  proposalAcceptedOn: (d) => `Proposition acceptée le ${d}.`,
  proposalPaid: "Paiement reçu. Merci.",
  acceptLabel: "Accepter la proposition",
  acceptBusy: "Enregistrement…",
  acceptError: "Nous n'avons pas pu enregistrer votre acceptation. Réessayez.",
  acceptedNotice: "Proposition acceptée. Vous pouvez maintenant payer.",
  acceptSummary: (total, tax) => `En acceptant, vous confirmez le total de ${total}${tax ? " TTC" : " HT"} indiqué ci-dessous.`,
  payLabel: "Payer",
  payRedirecting: "Redirection…",
  payError: "Le paiement n'a pas pu démarrer. Réessayez dans un instant.",
  summary: "Résumé de votre projet",
  photos: "Photos",
  photoAlt: (i) => `Photo ${i} de votre livre`,
  photoUnavailable: "Photo indisponible",
  photoOpen: (i) => `Agrandir la photo ${i}`,
  photoClose: "Fermer",
  theProject: "Votre projet",
  budgetAndTiming: "Budget et délai",
  toConfirmTitle: "Ce que nous devons encore confirmer",
  tentative: "à confirmer",
  workshop: "L'atelier retenu",
  workshopYears: (n) => `${n} ans de métier`,
  messages: "Messages",
  messagesEmpty: "Aucun message pour l'instant. Écrivez-nous si vous avez une question.",
  messagesPlaceholder: "Écrivez votre message…",
  messagesSend: "Envoyer le message",
  messagesSending: "Envoi…",
  messagesLoad: "Chargement des messages…",
  messagesError: "Impossible de charger les messages. Réessayez.",
  messagesSendError: "Votre message n'a pas pu être envoyé. Il est conservé ci-dessus : réessayez.",
  messageDeleted: "Message supprimé.",
  decisions: "Confirmations demandées",
  decisionsEmpty: "Aucune confirmation demandée pour l'instant.",
  history: "Historique",
  moreDetails: "Voir tous les détails",
  lessDetails: "Masquer les détails",
  location: "Localisation",
  contact: "Vos coordonnées",
  loading: "Chargement…",
  loadError: "Impossible de charger ce projet. Réessayez.",
  retry: "Réessayer",
  claimTitle: "Rattacher un projet",
  claimBody: "Vous avez présenté un livre avant de créer votre espace ? Collez le lien de suivi reçu par e-mail.",
  claimSummary: "Un projet manque à cette liste ?",
  claimButton: "Rattacher ce projet",
  claimBusy: "Rattachement…",
  claimDone: "Projet rattaché à votre espace.",
  claimAlready: "Ce projet était déjà rattaché à votre espace.",
  claimError: "Ce lien n'est pas valable ou a expiré. Vérifiez le lien reçu par e-mail et réessayez.",
  reference: "Référence",
  openProject: "Ouvrir le projet",
  heritageNote: "Ce type d'ouvrage demande une validation spécifique par un professionnel avant toute prise en charge.",
  manualReviewNote: "Nous examinons personnellement votre projet avant de le confier à un atelier.",
  decisionConfirm: "Confirmer mon choix",
  decisionConfirming: "Enregistrement…",
  decisionError: "Votre réponse n'a pas pu être enregistrée. Réessayez.",
  decisionConfirmedOn: (date) => (date ? `Confirmé le ${date}` : "Confirmé"),
  decisionCancelled: "Demande annulée.",
  decisionSuperseded: "Depuis corrigé : voir la confirmation plus récente.",
  decisionAnswerLabel: "Votre réponse",
  decisionAnswerPlaceholder: "Votre réponse",
  decisionGildingPlaceholder: "Texte exact à dorer",
  decisionGildingWarning: "Vérifiez attentivement l'orthographe. Cette validation sera transmise à l'atelier.",
  messageAuthorYou: "Vous",
  messageAuthorTeam: "Ma Reliure",
  messageAuthorWorkshop: "Votre atelier",
  messagesRetry: "Réessayer",
  sectionError: "Impossible de charger cette section. Réessayez.",
  messageCta: "Envoyer un message",
  skipToContent: "Aller au contenu",
  signOut: "Se déconnecter",
  signedInAs: "Connecté en tant que",
  backNavLabel: "Retour à la liste de vos livres",
  messagesRefreshError: "Impossible d'actualiser les messages pour le moment.",
  conciergeTitle: "Votre interlocuteur Ma Reliure",
  conciergeIntro: "Écrivez ici pour toute question sur votre livre.",
  conciergeEmpty: "Aucun message pour l'instant.",
  conciergePlaceholder: "Écrivez votre message…",
  conciergeAuthor: "Ma Reliure",
  conciergeCta: "Envoyer un message",
};

const EN: CustomerCopy = {
  brandHome: "Fine Bindery",
  myBooks: "My books",
  backToBooks: "My books",
  home: "Home",
  listTitle: "My books",
  listIntro: "Every project you have entrusted to us, where it stands, and what we need from you.",
  emptyTitle: "No projects yet",
  emptyBody: "Start a project to entrust us with a book: you will find it here, with its progress.",
  emptyCta: "Start a project",
  startProjectHref: `/m/${FINE_BINDERY_PUBLIC_TOKEN}`,
  createdOn: (d) => `Created ${d}`,
  newMessages: (n) => `${n} new message${n > 1 ? "s" : ""}`,
  actionRequired: "Action required",
  nextStep: "Next step",
  yourProposal: "Your proposal",
  proposalService: "Service",
  proposalShipping: "Shipping",
  proposalTotalHt: "Total excl. tax",
  proposalVat: (rate) => (rate ? `VAT (${rate})` : "VAT"),
  proposalTotalTtc: "Total incl. tax",
  proposalPriceKind: "Pricing",
  proposalPriceOnly: "Your project's price",
  proposalEstimate: (range) => `Estimate: ${range}. The final price is confirmed after the workshop has examined the book.`,
  proposalIncludes: "Includes",
  proposalNotPayable: "Payment will be available once your proposal has been validated.",
  proposalPayAfterAccept: "Payment will be available as soon as you accept the proposal.",
  proposalAcceptedOn: (d) => `Proposal accepted on ${d}.`,
  proposalPaid: "Payment received. Thank you.",
  acceptLabel: "Accept proposal",
  acceptBusy: "Saving…",
  acceptError: "We couldn't record your acceptance. Please try again.",
  acceptedNotice: "Proposal accepted. You can now pay securely.",
  acceptSummary: (total, tax) => `By accepting, you confirm the total of ${total}${tax ? " incl. tax" : " excl. tax"} shown below.`,
  payLabel: "Pay securely",
  payRedirecting: "Redirecting…",
  payError: "We couldn't start the payment. Please try again in a moment.",
  summary: "Your project at a glance",
  photos: "Photographs",
  photoAlt: (i) => `Photograph ${i} of your book`,
  photoUnavailable: "Photograph unavailable",
  photoOpen: (i) => `Enlarge photograph ${i}`,
  photoClose: "Close",
  theProject: "Your project",
  budgetAndTiming: "Budget and timing",
  toConfirmTitle: "What we still need to confirm",
  tentative: "to be confirmed",
  workshop: "Your workshop",
  workshopYears: (n) => `${n} years' experience`,
  messages: "Messages",
  messagesEmpty: "No messages yet. Write to us if you have a question.",
  messagesPlaceholder: "Write your message…",
  messagesSend: "Send message",
  messagesSending: "Sending…",
  messagesLoad: "Loading messages…",
  messagesError: "We couldn't load your messages. Please try again.",
  messagesSendError: "Your message couldn't be sent. It has been kept above: please try again.",
  messageDeleted: "Message deleted.",
  decisions: "Confirmations requested",
  decisionsEmpty: "No confirmation requested right now.",
  history: "History",
  moreDetails: "View all details",
  lessDetails: "Hide details",
  location: "Location",
  contact: "Your contact details",
  loading: "Loading…",
  loadError: "We couldn't load this project. Please try again.",
  retry: "Try again",
  claimTitle: "Link a project",
  claimBody: "Did you present a book before creating your space? Paste the tracking link you received by email.",
  claimSummary: "Is a project missing from this list?",
  claimButton: "Link this project",
  claimBusy: "Linking…",
  claimDone: "Project linked to your space.",
  claimAlready: "This project was already linked to your space.",
  claimError: "This link isn't valid or has expired. Check the link in your email and try again.",
  reference: "Reference",
  openProject: "Open project",
  heritageNote: "This type of book needs specific validation by a professional before it can be taken on.",
  manualReviewNote: "We are personally reviewing your project before entrusting it to a workshop.",
  decisionConfirm: "Confirm my choice",
  decisionConfirming: "Saving…",
  decisionError: "Your answer couldn't be saved. Please try again.",
  decisionConfirmedOn: (date) => (date ? `Confirmed on ${date}` : "Confirmed"),
  decisionCancelled: "Request cancelled.",
  decisionSuperseded: "Since corrected: see the more recent confirmation.",
  decisionAnswerLabel: "Your answer",
  decisionAnswerPlaceholder: "Your answer",
  decisionGildingPlaceholder: "Exact text to be gilded",
  decisionGildingWarning: "Check the spelling carefully. This confirmation will be passed on to the workshop.",
  messageAuthorYou: "You",
  messageAuthorTeam: "Fine Bindery",
  messageAuthorWorkshop: "Your workshop",
  messagesRetry: "Try again",
  sectionError: "We couldn't load this section. Please try again.",
  messageCta: "Send a message",
  skipToContent: "Skip to content",
  signOut: "Sign out",
  signedInAs: "Signed in as",
  backNavLabel: "Back to your books",
  messagesRefreshError: "We couldn't refresh your messages just now.",
  conciergeTitle: "Your Fine Bindery concierge",
  conciergeIntro: "Write here about anything to do with your book. Your concierge looks after it with you and coordinates with the workshop on your behalf.",
  conciergeEmpty: "No messages yet. Ask your concierge anything about your project.",
  conciergePlaceholder: "Write to your concierge…",
  conciergeAuthor: "Fine Bindery concierge",
  conciergeCta: "Message your concierge",
};

export function customerCopy(locale: CustomerLocale): CustomerCopy {
  return locale === "en-US" ? EN : FR;
}

/** Le locale d'un client : Fine Bindery en anglais, tout le reste (Ma Reliure) en français. */
export function customerLocaleForBrand(brand: "MA_RELIURE" | "FINE_BINDERY" | null): CustomerLocale {
  return brand === "FINE_BINDERY" ? "en-US" : "fr-FR";
}

export function formatCustomerDate(iso: string | null | undefined, locale: CustomerLocale): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(date);
}
