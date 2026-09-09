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
