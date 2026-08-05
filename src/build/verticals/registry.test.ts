import { describe, expect, it } from "vitest";
import { VERTICALS, matchVertical, selfServiceSummary, selfServiceVerticals } from "./registry";

describe("the registry describes what we recognise, without gating anyone", () => {
  it("ships exactly one self-service vertical today, and it is deck", () => {
    // Deck is the only hand-written Playbook. Every other trade still gets a
    // generated one — this list documents maturity, it does not restrict setup.
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
