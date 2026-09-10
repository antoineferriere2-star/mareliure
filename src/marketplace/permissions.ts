/**
 * Who may see a case, and how much of it.
 *
 * Two separate questions, on purpose. "May this relieur open the case?" is an
 * access decision. "May they see the customer's phone number?" is a disclosure
 * decision, and the answer changes the moment the customer picks them — §55.
 * Collapsing the two into one boolean is how a marketplace ends up handing
 * every invited workshop a customer's address.
 *
 * A customer is authorised by `customer_user_id` and by nothing else. An
 * earlier version compared `build_dossiers.visitor_email` to the signed-in
 * address, which made access a property of a string a visitor typed into a
 * public form: it survived only as long as nobody registered that address, and
 * it silently followed the address rather than the person. E-mail now does one
 * job — helping an account find an unclaimed case once, in
 * `cases/ownership.ts` — and grants nothing afterwards.
 *
 * Pure and framework-free so it can be exercised without a database. The
 * server functions call it before every read; the UI never decides anything.
 */

export type Viewer =
  | { role: "admin" }
  | { role: "binder"; binderId: string }
  | { role: "customer"; userId: string }
  | { role: "anonymous" };

export interface CaseAccessFacts {
  /** Relieurs currently invited on this case. */
  invitedBinderIds: readonly string[];
  /** The relieur the customer chose, once they have. */
  selectedBinderId: string | null;
  /** `marketplace_cases.customer_user_id` — null until the case is claimed. */
  customerUserId: string | null;
}

export function canViewCase(viewer: Viewer, facts: CaseAccessFacts): boolean {
  switch (viewer.role) {
    case "admin":
      return true;
    case "binder":
      return (
        facts.invitedBinderIds.includes(viewer.binderId) ||
        facts.selectedBinderId === viewer.binderId
      );
    case "customer":
      // An unclaimed case belongs to nobody yet, so it opens for nobody.
      // Claiming is a separate, deliberate act (cases/ownership.ts).
      return facts.customerUserId !== null && facts.customerUserId === viewer.userId;
    case "anonymous":
      return false;
  }
}

/**
 * Trois niveaux, parce qu'il y a trois audiences et non deux.
 *
 * `full` — l'administration et le client : tout, coordonnées et budget annoncé
 * compris. L'admin fixe le prix, le budget est une de ses entrées ; le client
 * regarde ses propres réponses.
 *
 * `assigned` — l'atelier retenu : les coordonnées, parce qu'un livre doit
 * voyager, mais jamais le budget annoncé. Ma Reliure fixe le prix et propose
 * une rémunération ; ce que le client disait vouloir mettre ne sert plus qu'à
 * reconstituer la marge.
 *
 * `project_only` — l'atelier sollicité mais pas encore retenu : le projet, les
 * photos, le délai et la ville. Les coordonnées se gagnent en étant choisi,
 * pas en étant invité (§55).
 */
export type CaseDisclosure = "full" | "assigned" | "project_only" | "none";

/** Les états d'une sollicitation qui donnent encore le droit de regarder le projet. */
export const LIVE_INVITATION_STATES = ["offered", "accepted", "invited", "quoted"] as const;

/**
 * Les faits d'accès **tels qu'un atelier doit les voir**.
 *
 * `invitedBinderIds` compte toutes les sollicitations d'un dossier : l'admin en
 * a besoin pour marquer « déjà invité » et tenir le plafond de trois. Pour
 * décider ce qu'un atelier peut ouvrir, en revanche, seule compte une
 * invitation encore en cours. Un atelier qui a refusé, dont l'offre a expiré
 * ou a été close, ou qui n'a pas été retenu quand un autre l'a été, ne voit
 * plus le Brief ni les photos du livre — ni, bien sûr, la conversation.
 */
export function binderAccessFacts(input: {
  matches: readonly { binderId: string; state: string }[];
  customerUserId: string | null;
}): CaseAccessFacts {
  const selected = input.matches.find((match) => match.state === "selected")?.binderId ?? null;
  return {
    invitedBinderIds:
      selected === null
        ? input.matches
            .filter((match) => (LIVE_INVITATION_STATES as readonly string[]).includes(match.state))
            .map((match) => match.binderId)
        : [],
    selectedBinderId: selected,
    customerUserId: input.customerUserId,
  };
}

export type ThreadAccess = "none" | "read" | "write";

/** Du choix de l'atelier au retour du livre : le fil est ouvert. */
const THREAD_WRITABLE_STATUSES: readonly string[] = [
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
];

/** Terminé ou annulé : le fil reste lisible, c'est l'archive du livre. */
const THREAD_ARCHIVED_STATUSES: readonly string[] = ["completed", "cancelled"];

/**
 * Qui lit et qui écrit dans le fil d'un projet.
 *
 * Le fil appartient au projet Ma Reliure. Il n'existe qu'une fois un atelier
 * retenu, et seul cet atelier y entre — jamais un atelier sollicité puis
 * écarté. Ma Reliure y a toujours accès, dans le cadre du suivi et du support.
 */
export function projectThreadAccess(
  viewer: Viewer,
  facts: CaseAccessFacts & { status: string },
): ThreadAccess {
  const stage = THREAD_WRITABLE_STATUSES.includes(facts.status)
    ? "write"
    : THREAD_ARCHIVED_STATUSES.includes(facts.status) && facts.selectedBinderId !== null
      ? "read"
      : "none";

  switch (viewer.role) {
    case "admin":
      return facts.selectedBinderId === null ? "none" : "write";
    case "customer":
      return facts.customerUserId !== null && facts.customerUserId === viewer.userId
        ? stage
        : "none";
    case "binder":
      return facts.selectedBinderId !== null && facts.selectedBinderId === viewer.binderId
        ? stage
        : "none";
    case "anonymous":
      return "none";
  }
}

export function caseDisclosure(viewer: Viewer, facts: CaseAccessFacts): CaseDisclosure {
  if (!canViewCase(viewer, facts)) return "none";
  switch (viewer.role) {
    case "admin":
    case "customer":
      return "full";
    case "binder":
      // Contact details are earned by being chosen, not by being invited —
      // mais un atelier ne voit le budget du client à aucun moment.
      return facts.selectedBinderId === viewer.binderId ? "assigned" : "project_only";
    case "anonymous":
      return "none";
  }
}
