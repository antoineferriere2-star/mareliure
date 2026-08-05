import { describe, expect, it } from "vitest";
import {
  VERTICALS,
  checkVerticalProduct,
  matchVertical,
  resolveVerticalEligibility,
  selfServiceSummary,
  selfServiceVerticals,
} from "./registry";

describe("the registry states what we can honestly deliver", () => {
  it("ships exactly one self-service vertical today, and it is deck", () => {
    // Promoting a vertical here is a claim that a client can finish setup
    // unassisted. Deck is the only Playbook that exists.
    expect(selfServiceVerticals().map((v) => v.id)).toEqual(["deck"]);
  });

  it("gives every vertical a distinct id and non-empty keywords", () => {
    const ids = VERTICALS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const v of VERTICALS) expect(v.keywords.length).toBeGreaterThan(0);
  });

  it("summarises support in words a client can read", () => {
    expect(selfServiceSummary()).toBe("deck");
  });
});

describe("matchVertical", () => {
  it("matches whole words, in English and French", () => {
    expect(matchVertical("Custom deck building")?.id).toBe("deck");
    expect(matchVertical("Composite decking")?.id).toBe("deck");
    expect(matchVertical("Terrasse bois")?.id).toBe("deck");
  });

  it("does not match a word that merely contains the letters", () => {
    // "Decker Roofing" is a roofer, not a deck builder.
    expect(matchVertical("Decker Roofing")).toBeNull();
    expect(matchVertical("Swimming pools")).toBeNull();
  });

  it("recognises experimental trades so we can name them", () => {
    expect(matchVertical("pergola installation")?.id).toBe("pergola");
    expect(matchVertical("Paver patios")?.id).toBe("patio");
  });
});

describe("resolveVerticalEligibility", () => {
  it("accepts a deck business and suggests the site's own wording", () => {
    const result = resolveVerticalEligibility({
      businessType: "Deck builder",
      isDeckBusiness: true,
      products: ["Composite decking", "Pergolas"],
    });
    expect(result.eligible).toBe(true);
    if (result.eligible) {
      expect(result.suggestedProducts).toContain("Deck");
      expect(result.suggestedProducts).toContain("Composite decking");
      // A trade we cannot deliver must never be offered as a product.
      expect(result.suggestedProducts).not.toContain("Pergolas");
    }
  });

  it("still accepts a site whose products mention decks even if the model said false", () => {
    const result = resolveVerticalEligibility({
      businessType: "General contractor",
      isDeckBusiness: false,
      products: ["Deck replacement"],
    });
    expect(result.eligible).toBe(true);
  });

  it("tells a pergola installer what we found and what we support", () => {
    // The old message said "we could not find deck work", which reads as if
    // the analysis had failed rather than as a scope limit.
    const result = resolveVerticalEligibility({
      businessType: "Pergola installer",
      isDeckBusiness: false,
      products: ["pergola installation"],
    });
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.reason).toBe(
        "We identified pergola installation. Métré Build currently supports deck projects in self-service.",
      );
      expect(result.identified?.id).toBe("pergola");
    }
  });

  it("names an unrecognised trade using the site's own words", () => {
    const result = resolveVerticalEligibility({
      businessType: "Swimming pool installer",
      isDeckBusiness: false,
      products: ["Pool installation"],
    });
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.reason).toContain("Pool installation");
      expect(result.reason).toContain("supports deck projects in self-service");
      expect(result.identified).toBeNull();
    }
  });

  it("does not treat an experimental vertical as eligible", () => {
    const result = resolveVerticalEligibility({
      businessType: "Fencing contractor",
      products: ["Fence installation"],
    });
    expect(result.eligible).toBe(false);
  });
});

describe("checkVerticalProduct", () => {
  it("keeps free-text confirmation inside a self-service vertical", () => {
    expect(checkVerticalProduct("  Composite deck resurfacing  ")).toEqual({
      ok: true,
      value: "Composite deck resurfacing",
    });
  });

  it.each([
    ["", "Product cannot be empty."],
    ["deck ".concat("x".repeat(81)), "Product is too long (80 characters max)."],
    [
      "Pergola",
      "Métré Build currently supports deck projects in self-service. Use wording that names that work.",
    ],
  ])("rejects invalid product %s", (input, error) => {
    expect(checkVerticalProduct(input)).toEqual({ ok: false, error });
  });
});
