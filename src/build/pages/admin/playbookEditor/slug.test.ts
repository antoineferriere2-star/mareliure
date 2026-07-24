import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
  it("lowercases and replaces separators with underscores", () => {
    expect(slugify("Deck replacement")).toBe("deck_replacement");
  });

  it("strips accents", () => {
    expect(slugify("Propriété désirée")).toBe("propriete_desiree");
  });

  it("falls back to a placeholder when nothing survives", () => {
    expect(slugify("!!!")).toBe("champ");
  });
});

describe("uniqueSlug", () => {
  it("returns the plain slug when it doesn't collide", () => {
    expect(uniqueSlug("Budget range", [])).toBe("budget_range");
  });

  it("appends a numeric suffix on collision", () => {
    expect(uniqueSlug("Option 1", ["option_1"])).toBe("option_1_2");
    expect(uniqueSlug("Option 1", ["option_1", "option_1_2"])).toBe("option_1_3");
  });
});
