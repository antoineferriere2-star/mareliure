import { describe, expect, it } from "vitest";
import { CUSTOMER_PROOFS } from "./customerProof";

describe("CUSTOMER_PROOFS", () => {
  it("stays empty until a real, verified customer quote exists — never a placeholder", () => {
    // CLAUDE.md and this session's audit both forbid inventing a
    // testimonial, logo, or metric. If this test starts failing because
    // someone added an entry, verify it is a real customer quote with
    // `verified: true` before updating this assertion.
    expect(CUSTOMER_PROOFS).toHaveLength(0);
  });
});
