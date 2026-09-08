/**
 * The three-relieur rule (§32), as a decision anything can call before it
 * writes.
 *
 * A request must never reach the whole marketplace. Three is the ceiling
 * because the alternative — fifteen artisans writing free proposals for one
 * book — destroys supply long before it annoys a customer, and no apology
 * brings a workshop back. The database enforces the same ceiling with a
 * trigger; this exists so the admin gets a sentence instead of a constraint
 * violation.
 */
import { MAX_BINDERS_PER_CASE } from "@/marketplace/config";

export interface SelectionCandidate {
  id: string;
  status: string;
}

export interface SelectionDecision {
  allowed: boolean;
  /** Ready to insert, in the order given. Empty when `allowed` is false. */
  binderIds: string[];
  /** Why not, in words the admin can act on. Empty when allowed. */
  problems: string[];
}

export function planBinderSelection(input: {
  /** Ids the admin ticked. */
  selectedIds: readonly string[];
  /** Every relieur the screen offered, with its current status. */
  candidates: readonly SelectionCandidate[];
  /** Relieurs already invited on this case, from a previous round. */
  alreadyInvitedIds: readonly string[];
}): SelectionDecision {
  const problems: string[] = [];
  const byId = new Map(input.candidates.map((candidate) => [candidate.id, candidate]));

  const unique = [...new Set(input.selectedIds)];
  if (unique.length === 0) {
    problems.push("Sélectionnez au moins un relieur.");
  }

  const unknown = unique.filter((id) => !byId.has(id));
  if (unknown.length > 0) {
    problems.push(`Relieur inconnu : ${unknown.join(", ")}.`);
  }

  const notApproved = unique.filter((id) => byId.get(id) && byId.get(id)!.status !== "approved");
  if (notApproved.length > 0) {
    problems.push("Seuls les relieurs approuvés peuvent recevoir une demande.");
  }

  const duplicates = unique.filter((id) => input.alreadyInvitedIds.includes(id));
  if (duplicates.length > 0) {
    problems.push("Un relieur déjà invité ne peut pas l'être une seconde fois.");
  }

  const total = input.alreadyInvitedIds.length + unique.length;
  if (total > MAX_BINDERS_PER_CASE) {
    problems.push(
      `Un dossier est envoyé à ${MAX_BINDERS_PER_CASE} relieurs au maximum (${input.alreadyInvitedIds.length} déjà invité(s)).`,
    );
  }

  return problems.length > 0
    ? { allowed: false, binderIds: [], problems }
    : { allowed: true, binderIds: unique, problems: [] };
}

/** How many more invitations this case can still carry. */
export function remainingInvitations(alreadyInvitedCount: number): number {
  return Math.max(0, MAX_BINDERS_PER_CASE - alreadyInvitedCount);
}
