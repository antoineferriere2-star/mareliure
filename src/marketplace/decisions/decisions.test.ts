import { describe, expect, it } from "vitest";
import { canAnswerDecision, canRequestDecision, canReviseDecision, decideAnswer } from "./decisions";
import type { Viewer } from "@/marketplace/permissions";

describe("canRequestDecision", () => {
  const facts = { selectedBinderId: "b-selected" };

  it("admin may always request one", () => {
    expect(canRequestDecision({ role: "admin" }, facts)).toBe(true);
  });

  it("the selected binder may request one", () => {
    expect(canRequestDecision({ role: "binder", binderId: "b-selected" }, facts)).toBe(true);
  });

  it("a binder that is not selected may not — invited is not assigned", () => {
    expect(canRequestDecision({ role: "binder", binderId: "b-invited" }, facts)).toBe(false);
  });

  it("no binder at all may request one on an unassigned case", () => {
    expect(
      canRequestDecision({ role: "binder", binderId: "b-any" }, { selectedBinderId: null }),
    ).toBe(false);
  });

  it("the customer may never request a decision of themselves", () => {
    expect(canRequestDecision({ role: "customer", userId: "u1" }, facts)).toBe(false);
  });
});

describe("canAnswerDecision", () => {
  const facts = { customerUserId: "u1" };

  it("the case's own customer may answer", () => {
    expect(canAnswerDecision({ role: "customer", userId: "u1" }, facts)).toBe(true);
  });

  it("a different customer may not", () => {
    expect(canAnswerDecision({ role: "customer", userId: "someone-else" }, facts)).toBe(false);
  });

  it("the binder that asked the question may never answer it themselves", () => {
    expect(canAnswerDecision({ role: "binder", binderId: "b-selected" }, facts)).toBe(false);
  });

  it("admin may never answer on the customer's behalf", () => {
    expect(canAnswerDecision({ role: "admin" }, facts)).toBe(false);
  });
});

describe("decideAnswer", () => {
  it("allows answering an open decision", () => {
    expect(decideAnswer({ status: "open" }).allowed).toBe(true);
  });

  it("refuses answering one already answered", () => {
    expect(decideAnswer({ status: "answered" }).allowed).toBe(false);
  });

  it("refuses answering a cancelled decision", () => {
    expect(decideAnswer({ status: "cancelled" }).allowed).toBe(false);
  });
});

describe("canReviseDecision", () => {
  const facts = { selectedBinderId: "b-selected" };

  it("the assigned binder may revise an answered decision", () => {
    expect(
      canReviseDecision({ role: "binder", binderId: "b-selected" }, { status: "answered" }, facts),
    ).toBe(true);
  });

  it("admin may always revise an answered decision", () => {
    expect(canReviseDecision({ role: "admin" }, { status: "answered" }, facts)).toBe(true);
  });

  it("a binder no longer assigned to the case may not revise it", () => {
    // The point over comparing the original requester's user id: membership
    // can change hands within a workshop (Phase A), so authority to revise
    // follows the atelier's current assignment, not who typed the question.
    expect(
      canReviseDecision({ role: "binder", binderId: "someone-else" }, { status: "answered" }, facts),
    ).toBe(false);
  });

  it("an open decision has nothing to revise — it is still answerable directly", () => {
    expect(canReviseDecision({ role: "admin" }, { status: "open" }, facts)).toBe(false);
  });

  it("a cancelled decision has nothing to revise — it needs a fresh request", () => {
    expect(canReviseDecision({ role: "admin" }, { status: "cancelled" }, facts)).toBe(false);
  });
});
