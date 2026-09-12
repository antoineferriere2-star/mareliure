import { describe, expect, it } from "vitest";
import { canReviewApplications, decideReview } from "./application";

describe("canReviewApplications", () => {
  it("only admin may review applications", () => {
    expect(canReviewApplications({ role: "admin" })).toBe(true);
  });

  it("a binder cannot review applications, even its own", () => {
    expect(canReviewApplications({ role: "binder", binderId: "b1" })).toBe(false);
  });

  it("a customer cannot review applications", () => {
    expect(canReviewApplications({ role: "customer", userId: "u1" })).toBe(false);
  });

  it("anonymous cannot review applications", () => {
    expect(canReviewApplications({ role: "anonymous" })).toBe(false);
  });
});

describe("decideReview", () => {
  it("allows reviewing a new application", () => {
    expect(decideReview({ status: "new" }).allowed).toBe(true);
  });

  it("refuses reviewing one already reviewed", () => {
    expect(decideReview({ status: "reviewed" }).allowed).toBe(false);
  });

  it("refuses reviewing one already accepted or rejected", () => {
    expect(decideReview({ status: "accepted" }).allowed).toBe(false);
    expect(decideReview({ status: "rejected" }).allowed).toBe(false);
  });
});
