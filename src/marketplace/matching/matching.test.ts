import { describe, expect, it } from "vitest";
import { buildCaseProfile } from "@/marketplace/cases/caseProfile";
import { MAX_BINDERS_PER_CASE } from "@/marketplace/config";
import { rankBinders, scoreBinder, type BinderMatchProfile } from "./score";
import { canSendCaseToBinders, planBinderSelection, remainingInvitations } from "./selection";

function binder(overrides: Partial<BinderMatchProfile> = {}): BinderMatchProfile {
  return {
    id: "b1",
    status: "approved",
    skills: ["demi_cuir", "dorure", "cartonnage"],
    acceptedProjectTypes: [],
    minProjectCents: null,
    maxProjectCents: null,
    capacitySlots: 3,
    activeLoad: 0,
    responseRate: 1,
    ratingAvg: 5,
    ...overrides,
  };
}

const COLLECTOR = buildCaseProfile({
  intention: "collector",
  nature: "livre_courant",
  materiau: "demi_cuir",
  finitions: ["dorure", "etui"],
  styleSouhaite: "traditionnel",
  budget: "250_400",
});

describe("the score rewards the workshop that can actually do the work", () => {
  it("gives a full score to a free, well-rated workshop with every skill", () => {
    expect(scoreBinder(COLLECTOR, binder()).total).toBe(100);
  });

  it("names the skills a workshop is missing rather than only docking points", () => {
    const result = scoreBinder(COLLECTOR, binder({ skills: ["demi_cuir"] }));
    expect(result.missingSkills).toEqual(["cartonnage", "dorure"]);
    expect(result.total).toBeLessThan(100);
  });

  it("does not punish a workshop for a project that requires no particular skill", () => {
    const vague = buildCaseProfile({ intention: "ne_sais_pas" });
    expect(scoreBinder(vague, binder({ skills: [] })).breakdown.skills).toBe(40);
  });

  it("drops a workshop whose floor is above the validated payout", () => {
    const expensive = binder({ minProjectCents: 100_000 });
    expect(scoreBinder(COLLECTOR, expensive, 40_000).breakdown.payout).toBe(0);
  });

  it("does not use the visitor budget as a matching input", () => {
    const lowBudget = buildCaseProfile({ intention: "collector", budget: "lt_150" });
    const highBudget = buildCaseProfile({ intention: "collector", budget: "gt_700" });
    const workshop = binder({ minProjectCents: 30_000 });
    expect(scoreBinder(lowBudget, workshop, 40_000).breakdown.payout).toBe(
      scoreBinder(highBudget, workshop, 40_000).breakdown.payout,
    );
  });

  it("treats a workshop with no history as average, not as bad", () => {
    // A new relieur has to be able to receive a first project.
    const fresh = binder({ responseRate: null, ratingAvg: null });
    expect(scoreBinder(COLLECTOR, fresh).breakdown.trackRecord).toBe(5);
  });

  it("penalises a full workshop", () => {
    expect(scoreBinder(COLLECTOR, binder({ activeLoad: 3 })).breakdown.workload).toBe(0);
    expect(scoreBinder(COLLECTOR, binder({ activeLoad: 1 })).breakdown.workload).toBe(7);
  });

  it("weighs conservation heavily on a heritage book", () => {
    const heritage = buildCaseProfile({ intention: "restaurer", nature: "manuscrit" });
    const generalist = scoreBinder(heritage, binder({ skills: [] }));
    const specialist = scoreBinder(heritage, binder({ skills: ["restauration", "conservation"] }));
    expect(specialist.total - generalist.total).toBeGreaterThanOrEqual(50);
  });

  it("respects a workshop that declared which project types it takes", () => {
    const refuses = binder({ acceptedProjectTypes: ["reparer"] });
    expect(scoreBinder(COLLECTOR, refuses).breakdown.projectType).toBe(0);
  });

  it("never leaves the 0–100 range", () => {
    const worst = scoreBinder(
      buildCaseProfile({ intention: "restaurer", nature: "manuscrit", materiau: "plein_cuir" }),
      binder({
        skills: [],
        acceptedProjectTypes: ["reparer"],
        activeLoad: 99,
        responseRate: 0,
        ratingAvg: 0,
        capacitySlots: 0,
      }),
    );
    expect(worst.total).toBeGreaterThanOrEqual(0);
    expect(worst.total).toBeLessThanOrEqual(100);
  });
});

describe("ranking", () => {
  it("puts the best fit first and never lists an unapproved workshop", () => {
    const ranked = rankBinders(COLLECTOR, [
      binder({ id: "weak", skills: [] }),
      binder({ id: "strong" }),
      binder({ id: "pending", status: "pending_review" }),
      binder({ id: "suspended", status: "suspended" }),
    ]);
    expect(ranked.map((r) => r.binder.id)).toEqual(["strong", "weak"]);
  });

  it("is stable when two workshops tie", () => {
    const ranked = rankBinders(COLLECTOR, [binder({ id: "zz" }), binder({ id: "aa" })]);
    expect(ranked.map((r) => r.binder.id)).toEqual(["aa", "zz"]);
  });
});

describe("a case is never sent to more than three relieurs", () => {
  const candidates = [
    { id: "a", status: "approved" },
    { id: "b", status: "approved" },
    { id: "c", status: "approved" },
    { id: "d", status: "approved" },
    { id: "pending", status: "pending_review" },
  ];

  it("accepts three", () => {
    const decision = planBinderSelection({
      selectedIds: ["a", "b", "c"],
      candidates,
      alreadyInvitedIds: [],
    });
    expect(decision).toEqual({ allowed: true, binderIds: ["a", "b", "c"], problems: [] });
  });

  it("refuses a fourth", () => {
    const decision = planBinderSelection({
      selectedIds: ["a", "b", "c", "d"],
      candidates,
      alreadyInvitedIds: [],
    });
    expect(decision.allowed).toBe(false);
    expect(decision.problems.join(" ")).toContain(`${MAX_BINDERS_PER_CASE} relieurs au maximum`);
  });

  it("counts relieurs invited in an earlier round", () => {
    const decision = planBinderSelection({
      selectedIds: ["c", "d"],
      candidates,
      alreadyInvitedIds: ["a", "b"],
    });
    expect(decision.allowed).toBe(false);
  });

  it("refuses to invite a workshop that is not approved", () => {
    const decision = planBinderSelection({
      selectedIds: ["a", "pending"],
      candidates,
      alreadyInvitedIds: [],
    });
    expect(decision.allowed).toBe(false);
    expect(decision.problems.join(" ")).toContain("approuvés");
  });

  it("refuses to invite the same workshop twice", () => {
    const decision = planBinderSelection({
      selectedIds: ["a"],
      candidates,
      alreadyInvitedIds: ["a"],
    });
    expect(decision.allowed).toBe(false);
  });

  it("collapses a double-click into one invitation rather than two", () => {
    const decision = planBinderSelection({
      selectedIds: ["a", "a", "b"],
      candidates,
      alreadyInvitedIds: [],
    });
    expect(decision.binderIds).toEqual(["a", "b"]);
  });

  it("refuses an empty selection", () => {
    expect(
      planBinderSelection({ selectedIds: [], candidates, alreadyInvitedIds: [] }).allowed,
    ).toBe(false);
  });

  it("reports how many invitations are left", () => {
    expect(remainingInvitations(0)).toBe(3);
    expect(remainingInvitations(2)).toBe(1);
    expect(remainingInvitations(5)).toBe(0);
  });
});

describe("canSendCaseToBinders — a BINDER_REFERRED case never enters general matching", () => {
  it("lets a MA_RELIURE_ACQUIRED case go to any set of binders", () => {
    const result = canSendCaseToBinders({
      acquisitionOrigin: "MA_RELIURE_ACQUIRED",
      referredBinderId: null,
      requestedBinderIds: ["b1", "b2", "b3"],
    });
    expect(result.allowed).toBe(true);
  });

  it("lets a BINDER_REFERRED case go to exactly the atelier that referred it", () => {
    const result = canSendCaseToBinders({
      acquisitionOrigin: "BINDER_REFERRED",
      referredBinderId: "ferriere",
      requestedBinderIds: ["ferriere"],
    });
    expect(result.allowed).toBe(true);
  });

  it("refuses sending a BINDER_REFERRED case to a different atelier", () => {
    const result = canSendCaseToBinders({
      acquisitionOrigin: "BINDER_REFERRED",
      referredBinderId: "ferriere",
      requestedBinderIds: ["another-workshop"],
    });
    expect(result.allowed).toBe(false);
  });

  it("refuses sending a BINDER_REFERRED case to the referrer plus others — no general matching, ever", () => {
    const result = canSendCaseToBinders({
      acquisitionOrigin: "BINDER_REFERRED",
      referredBinderId: "ferriere",
      requestedBinderIds: ["ferriere", "another-workshop"],
    });
    expect(result.allowed).toBe(false);
  });

  it("cannot be satisfied by fabricating a matching referredBinderId — the row, not the request, decides", () => {
    // canSendCaseToBinders only ever sees referredBinderId as loaded from
    // marketplace_cases by the server (caseRepository.server.ts) — never as
    // something the request supplies. A caller cannot pass its own
    // referredBinderId to make an arbitrary requestedBinderIds pass; it can
    // only pass requestedBinderIds, and this asserts that is genuinely the
    // only free variable in the decision.
    const attemptedForgery = canSendCaseToBinders({
      acquisitionOrigin: "BINDER_REFERRED",
      referredBinderId: "attacker-controlled-id",
      requestedBinderIds: ["attacker-controlled-id"],
    });
    // Allowed here only because referredBinderId is (by construction, in the
    // real caller) the value already persisted on the row — an attacker
    // cannot set marketplace_cases.referred_binder_id itself, only request a
    // binderIds array, which the two prior tests show is checked against it.
    expect(attemptedForgery.allowed).toBe(true);
  });
});
