/**
 * Structured decisions — never a chat message doing a technical choice's job
 * (§20-§22).
 *
 * A decision has exactly one lifecycle: `open` → `answered` (immutable from
 * then on) or `open` → `cancelled`. Correcting an answered decision never
 * reopens or rewrites it — see reviseDecision below — a case a titrage error
 * would otherwise make silently disappear from the record.
 *
 * Pure and framework-free, like ownership.ts and membership.ts.
 */
import type { Viewer } from "@/marketplace/permissions";

export const DECISION_KINDS = [
  "COLOR",
  "MATERIAL",
  "PAPER",
  "GILDING_TEXT",
  "GILDING_STYLE",
  "DECOR",
  "TECHNICAL_CHOICE",
  "OTHER",
] as const;
export type DecisionKind = (typeof DECISION_KINDS)[number];

export const DECISION_STATUSES = ["open", "answered", "cancelled"] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

/** Only these two roles may ask a customer for a decision — never the customer themselves. */
export const DECISION_REQUESTER_ROLES = ["binder", "admin"] as const;
export type DecisionRequesterRole = (typeof DECISION_REQUESTER_ROLES)[number];

/**
 * Only the case's own customer may request a decision — a binder cannot ask
 * a question of a project they were only invited to, and an admin can always
 * act. Mirrors the "assigned" disclosure level in permissions.ts: a binder
 * that is not the one selected has no decision to ask.
 */
export function canRequestDecision(
  viewer: Viewer,
  facts: { selectedBinderId: string | null },
): boolean {
  if (viewer.role === "admin") return true;
  if (viewer.role === "binder") return facts.selectedBinderId === viewer.binderId;
  return false;
}

/** Only the case's own customer may answer — never the binder, never an admin on their behalf. */
export function canAnswerDecision(
  viewer: Viewer,
  facts: { customerUserId: string | null },
): boolean {
  return (
    viewer.role === "customer" &&
    facts.customerUserId !== null &&
    facts.customerUserId === viewer.userId
  );
}

export interface AnswerDecisionDecision {
  allowed: boolean;
  reason?: string;
}

/** Whether a given decision row may still receive an answer. */
export function decideAnswer(decision: { status: string }): AnswerDecisionDecision {
  if (decision.status !== "open") {
    return { allowed: false, reason: "Cette décision n'est plus ouverte." };
  }
  return { allowed: true };
}

/**
 * Whether a requester may revise an already-answered decision.
 *
 * The same authority as asking a new one (canRequestDecision) — a workshop
 * membership can have more than one person since Phase A, so "may revise"
 * is a question about which atelier is assigned to the case, never about
 * which individual account typed the original question. Only a decision
 * that has actually been answered has anything to correct: an open one is
 * edited by cancelling and asking again, a cancelled one needs a fresh
 * request, not a "revision" of nothing.
 */
export function canReviseDecision(
  viewer: Viewer,
  decision: { status: string },
  facts: { selectedBinderId: string | null },
): boolean {
  if (decision.status !== "answered") return false;
  return canRequestDecision(viewer, facts);
}
