/**
 * Phase 0 / P1-5 — un dossier engagé ne revient jamais silencieusement au chiffrage.
 */
import { describe, expect, it } from "vitest";
import { COMMITTED_STATUSES, PRICING_EDITABLE_STATUSES, REPRICE_BLOCK_MESSAGES, repriceVerdict } from "./engagement";
import { CASE_STATUSES } from "./state";

describe("repriceVerdict — statut par statut, sans proposition acceptée", () => {
  it.each([
    ["under_review", { allowed: true }],
    ["pricing", { allowed: true }],
    ["matching", { allowed: true }],
    ["awaiting_binder_response", { allowed: false, reason: "offers_out" }],
    ["binder_accepted", { allowed: false, reason: "offers_out" }],
    ["binder_selected", { allowed: false, reason: "case_committed" }],
    ["awaiting_payment", { allowed: false, reason: "case_committed" }],
    ["paid", { allowed: false, reason: "case_committed" }],
    ["shipping_to_binder", { allowed: false, reason: "case_committed" }],
    ["received_by_binder", { allowed: false, reason: "case_committed" }],
    ["in_progress", { allowed: false, reason: "case_committed" }],
    ["awaiting_approval", { allowed: false, reason: "case_committed" }],
    ["shipping_to_customer", { allowed: false, reason: "case_committed" }],
    ["delivered", { allowed: false, reason: "case_committed" }],
    ["completed", { allowed: false, reason: "case_committed" }],
    ["cancelled", { allowed: false, reason: "case_cancelled" }],
  ] as const)("%s → %j", (status, expected) => {
    expect(repriceVerdict({ status, hasAcceptedProposal: false })).toEqual(expected);
  });

  it("chaque statut de l'automate est couvert : éditable, engagé, offres en cours ou annulé — aucun trou", () => {
    for (const status of CASE_STATUSES) {
      const verdict = repriceVerdict({ status, hasAcceptedProposal: false });
      const classified =
        PRICING_EDITABLE_STATUSES.includes(status) ||
        COMMITTED_STATUSES.includes(status) ||
        ["awaiting_binder_response", "binder_accepted", "cancelled"].includes(status);
      expect(classified, status).toBe(true);
      expect(verdict.allowed, status).toBe(PRICING_EDITABLE_STATUSES.includes(status));
    }
  });
});

describe("repriceVerdict — une proposition acceptée fige tout, quel que soit le statut", () => {
  it.each(CASE_STATUSES)("%s + proposition acceptée → refusé", (status) => {
    expect(repriceVerdict({ status, hasAcceptedProposal: true })).toEqual({ allowed: false, reason: "proposal_accepted" });
  });
});

describe("repriceVerdict — fail closed", () => {
  it("un statut inconnu n'ouvre jamais le chiffrage", () => {
    expect(repriceVerdict({ status: "sent_to_binders", hasAcceptedProposal: false }).allowed).toBe(false);
    expect(repriceVerdict({ status: "", hasAcceptedProposal: false }).allowed).toBe(false);
  });

  it("chaque refus a un message lisible qui dit quoi faire (nouvelle version, jamais un code brut)", () => {
    for (const message of Object.values(REPRICE_BLOCK_MESSAGES)) {
      expect(message.length).toBeGreaterThan(15);
      expect(message).not.toMatch(/case_engaged|_/);
    }
    expect(REPRICE_BLOCK_MESSAGES.proposal_accepted).toMatch(/nouvelle version/i);
    expect(REPRICE_BLOCK_MESSAGES.case_committed).toMatch(/nouvelle version/i);
  });
});
