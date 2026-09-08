import { describe, expect, it } from "vitest";
import {
  QUOTE_CAVEAT,
  canBinderQuote,
  orderQuotesForComparison,
  validateQuote,
  type QuoteInput,
} from "./rules";

const NOW = new Date("2026-09-08T12:00:00.000Z");

function quote(overrides: Partial<QuoteInput> = {}): QuoteInput {
  return {
    description:
      "Demi-reliure en chèvre brun foncé, plats papier marbré, cinq nerfs et titrage or.",
    amountCents: 34_000,
    leadTimeWeeks: 7,
    ...overrides,
  };
}

describe("what makes a proposal acceptable", () => {
  it("accepts a complete one", () => {
    expect(validateQuote(quote(), NOW)).toEqual([]);
  });

  it("insists on a description the customer can actually compare", () => {
    // Three offers that all say "reliure cuir" are three prices, which is
    // exactly the comparison §37 is trying to avoid.
    expect(validateQuote(quote({ description: "Cuir" }), NOW)[0]).toContain("Décrivez");
  });

  it("refuses an amount that is not whole cents, or outside the plausible range", () => {
    expect(validateQuote(quote({ amountCents: 340.5 }), NOW)).not.toEqual([]);
    expect(validateQuote(quote({ amountCents: 100 }), NOW)).not.toEqual([]);
    expect(validateQuote(quote({ amountCents: 5_000_000 }), NOW)).not.toEqual([]);
  });

  it("refuses a missing or absurd lead time", () => {
    expect(validateQuote(quote({ leadTimeWeeks: 0 }), NOW)).not.toEqual([]);
    expect(validateQuote(quote({ leadTimeWeeks: 200 }), NOW)).not.toEqual([]);
  });

  it("refuses a validity date already in the past", () => {
    expect(validateQuote(quote({ validUntil: "2026-09-01" }), NOW)).not.toEqual([]);
    expect(validateQuote(quote({ validUntil: "2026-12-01" }), NOW)).toEqual([]);
  });

  it("reports every problem at once", () => {
    expect(
      validateQuote(quote({ description: "x", amountCents: 1, leadTimeWeeks: 0 }), NOW),
    ).toHaveLength(3);
  });

  it("carries the standing caveat", () => {
    expect(QUOTE_CAVEAT).toContain("inspection physique");
  });
});

describe("who may propose, and when", () => {
  it("lets an invited relieur propose while the case is open", () => {
    expect(canBinderQuote({ caseStatus: "sent_to_binders", matchState: "invited" }).allowed).toBe(
      true,
    );
    expect(canBinderQuote({ caseStatus: "quotes_received", matchState: "invited" }).allowed).toBe(
      true,
    );
  });

  it("refuses a relieur who was never invited", () => {
    const result = canBinderQuote({ caseStatus: "sent_to_binders", matchState: null });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("ne vous a pas été confié");
  });

  it("refuses a relieur who declined", () => {
    expect(canBinderQuote({ caseStatus: "sent_to_binders", matchState: "declined" }).allowed).toBe(
      false,
    );
  });

  it("refuses once the customer has chosen", () => {
    expect(canBinderQuote({ caseStatus: "binder_selected", matchState: "invited" }).allowed).toBe(
      false,
    );
  });
});

describe("how the customer sees the offers", () => {
  const offers = [
    { id: "c", amountCents: 34_000, leadTimeWeeks: 7, submittedAt: "2026-09-03T10:00:00Z" },
    { id: "b", amountCents: 28_000, leadTimeWeeks: 5, submittedAt: "2026-09-02T10:00:00Z" },
    { id: "a", amountCents: 45_000, leadTimeWeeks: 4, submittedAt: "2026-09-01T10:00:00Z" },
  ];

  it("orders them by arrival, never by price", () => {
    // Cheapest-first would be a ranking, and a ranking is a recommendation the
    // platform has no business making between three artisans.
    expect(orderQuotesForComparison(offers).map((q) => q.id)).toEqual(["a", "b", "c"]);
  });

  it("never shows more than three", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      id: `q${i}`,
      amountCents: 10_000,
      leadTimeWeeks: 4,
      submittedAt: `2026-09-0${i + 1}T10:00:00Z`,
    }));
    expect(orderQuotesForComparison(many)).toHaveLength(3);
  });

  it("does not mutate what it was given", () => {
    const original = [...offers];
    orderQuotesForComparison(offers);
    expect(offers).toEqual(original);
  });
});
