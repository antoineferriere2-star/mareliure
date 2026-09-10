import { describe, expect, it } from "vitest";
import {
  CASE_STATUSES,
  CASE_STATUS_LABELS,
  canSendToBinders,
  canTransitionCase,
  isCaseStatus,
  nextCaseStatuses,
} from "./state";

describe("the transaction's states", () => {
  it("labels every one of them, so no screen renders a raw enum", () => {
    for (const status of CASE_STATUSES) {
      expect(CASE_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it("recognises its own statuses and nothing else", () => {
    expect(isCaseStatus("paid")).toBe(true);
    // Métré's own qualification statuses live in a different vocabulary and
    // must never be assigned here.
    expect(isCaseStatus("ready")).toBe(false);
    expect(isCaseStatus("draft")).toBe(false);
  });

  it("walks the happy path from ingestion to completion", () => {
    const path = [
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
      "work_finished",
      "shipping_to_customer",
      "delivered",
      "completed",
    ] as const;
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(canTransitionCase(path[i], path[i + 1]), `${path[i]} -> ${path[i + 1]}`).toBe(true);
    }
  });

  /**
   * Le chemin provisoire décidé le 10 septembre 2026, tant que ni le paiement
   * en ligne ni l'expédition n'existent : Ma Reliure confirme la commande,
   * l'atelier confirme la réception.
   */
  it("walks the provisional path while payment and shipping are not built", () => {
    const path = [
      "binder_selected",
      "paid",
      "received_by_binder",
      "in_progress",
      "work_finished",
    ] as const;
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(canTransitionCase(path[i], path[i + 1]), `${path[i]} -> ${path[i + 1]}`).toBe(true);
    }
  });

  it("never announces a return shipment the work has not finished", () => {
    expect(canTransitionCase("in_progress", "shipping_to_customer")).toBe(false);
    expect(canTransitionCase("received_by_binder", "work_finished")).toBe(false);
  });

  it("refuses jumps that skip the work", () => {
    expect(canTransitionCase("under_review", "paid")).toBe(false);
    expect(canTransitionCase("delivered", "binder_accepted")).toBe(false);
    expect(canTransitionCase("completed", "in_progress")).toBe(false);
  });

  it("allows going back to matching while no one has been chosen", () => {
    expect(canTransitionCase("awaiting_binder_response", "matching")).toBe(true);
    expect(canTransitionCase("binder_accepted", "matching")).toBe(true);
  });

  it("stops offering cancellation once the customer has paid", () => {
    // After payment, undoing is a refund conversation, not a status change.
    expect(nextCaseStatuses("awaiting_payment")).toContain("cancelled");
    expect(nextCaseStatuses("paid")).not.toContain("cancelled");
    expect(nextCaseStatuses("in_progress")).not.toContain("cancelled");
  });
});

describe("a case held for manual review reaches no relieur", () => {
  it("is blocked until a human clears it", () => {
    expect(
      canSendToBinders({
        status: "matching",
        manualReviewRequired: true,
        reviewCleared: false,
        pricingValidated: true,
      }),
    ).toBe(false);
    expect(
      canSendToBinders({
        status: "matching",
        manualReviewRequired: true,
        reviewCleared: true,
        pricingValidated: true,
      }),
    ).toBe(true);
  });

  it("requires both a validated price and the matching state", () => {
    expect(
      canSendToBinders({
        status: "pricing",
        manualReviewRequired: false,
        reviewCleared: false,
        pricingValidated: true,
      }),
    ).toBe(false);
    expect(
      canSendToBinders({
        status: "matching",
        manualReviewRequired: false,
        reviewCleared: false,
        pricingValidated: false,
      }),
    ).toBe(false);
    expect(
      canSendToBinders({
        status: "matching",
        manualReviewRequired: false,
        reviewCleared: false,
        pricingValidated: true,
      }),
    ).toBe(true);
  });

  it("cannot be sent again once the transaction has moved on", () => {
    expect(
      canSendToBinders({
        status: "binder_selected",
        manualReviewRequired: false,
        reviewCleared: true,
        pricingValidated: true,
      }),
    ).toBe(false);
  });
});
