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
      "matching",
      "sent_to_binders",
      "quotes_received",
      "binder_selected",
      "awaiting_payment",
      "paid",
      "shipping_to_binder",
      "received_by_binder",
      "in_progress",
      "shipping_to_customer",
      "delivered",
      "completed",
    ] as const;
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(canTransitionCase(path[i], path[i + 1]), `${path[i]} -> ${path[i + 1]}`).toBe(true);
    }
  });

  it("refuses jumps that skip the work", () => {
    expect(canTransitionCase("under_review", "paid")).toBe(false);
    expect(canTransitionCase("delivered", "quotes_received")).toBe(false);
    expect(canTransitionCase("completed", "in_progress")).toBe(false);
  });

  it("allows going back to matching while no one has been chosen", () => {
    expect(canTransitionCase("sent_to_binders", "matching")).toBe(true);
    expect(canTransitionCase("quotes_received", "matching")).toBe(true);
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
      canSendToBinders({ status: "matching", manualReviewRequired: true, reviewCleared: false }),
    ).toBe(false);
    expect(
      canSendToBinders({ status: "matching", manualReviewRequired: true, reviewCleared: true }),
    ).toBe(true);
  });

  it("is otherwise sendable from the two states that mean 'not yet sent'", () => {
    for (const status of ["under_review", "matching"] as const) {
      expect(canSendToBinders({ status, manualReviewRequired: false, reviewCleared: false })).toBe(
        true,
      );
    }
  });

  it("cannot be sent again once the transaction has moved on", () => {
    expect(
      canSendToBinders({
        status: "binder_selected",
        manualReviewRequired: false,
        reviewCleared: true,
      }),
    ).toBe(false);
  });
});
