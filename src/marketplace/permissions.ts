/**
 * Who may see a case, and how much of it.
 *
 * Two separate questions, on purpose. "May this relieur open the case?" is an
 * access decision. "May they see the customer's phone number?" is a disclosure
 * decision, and the answer changes the moment the customer picks them — §55.
 * Collapsing the two into one boolean is how a marketplace ends up handing
 * every invited workshop a customer's address.
 *
 * Pure and framework-free so it can be exercised without a database. The
 * server functions call it before every read; the UI never decides anything.
 */

export type Viewer =
  | { role: "admin" }
  | { role: "binder"; binderId: string }
  | { role: "customer"; email: string }
  | { role: "anonymous" };

export interface CaseAccessFacts {
  /** Relieurs currently invited on this case. */
  invitedBinderIds: readonly string[];
  /** The relieur the customer chose, once they have. */
  selectedBinderId: string | null;
  /** From build_dossiers.visitor_email. Compared case-insensitively. */
  customerEmail: string | null;
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
      return (
        facts.customerEmail !== null &&
        facts.customerEmail.trim().toLowerCase() === viewer.email.trim().toLowerCase()
      );
    case "anonymous":
      return false;
  }
}

/**
 * `full` includes the customer's name, e-mail, phone and precise address.
 * `project_only` is the same case with all of that removed — the project, the
 * photos, the budget, the timing and the town, which is everything a relieur
 * needs to decide whether to propose (§55).
 */
export type CaseDisclosure = "full" | "project_only" | "none";

export function caseDisclosure(viewer: Viewer, facts: CaseAccessFacts): CaseDisclosure {
  if (!canViewCase(viewer, facts)) return "none";
  switch (viewer.role) {
    case "admin":
    case "customer":
      return "full";
    case "binder":
      // Contact details are earned by being chosen, not by being invited.
      return facts.selectedBinderId === viewer.binderId ? "full" : "project_only";
    case "anonymous":
      return "none";
  }
}
