import { describe, expect, it } from "vitest";
import { DEFAULT_PUBLIC_BRAND, PUBLIC_BRANDS, resolvePublicBrand } from "./brand";

describe("which brand a deployment serves", () => {
  it("defaults to Métré, so an unset variable changes nothing", () => {
    // Every existing Métré Build deployment has no VITE_PUBLIC_BRAND. Adding
    // this switch must be invisible to all of them.
    expect(DEFAULT_PUBLIC_BRAND).toBe("metre");
    expect(resolvePublicBrand(undefined)).toBe("metre");
    expect(resolvePublicBrand("")).toBe("metre");
  });

  it("recognises the brands it actually ships", () => {
    expect(PUBLIC_BRANDS).toEqual(["metre", "mareliure"]);
    expect(resolvePublicBrand("mareliure")).toBe("mareliure");
    expect(resolvePublicBrand("metre")).toBe("metre");
  });

  it("falls back rather than throwing on a value it does not know", () => {
    // A typo in a deployment variable must serve the default homepage, not a
    // 500. Wrong content is noticed in seconds; a crashed root route at 3am is
    // an outage.
    expect(resolvePublicBrand("mareliure ")).toBe("metre");
    expect(resolvePublicBrand("MaReliure")).toBe("metre");
    expect(resolvePublicBrand(null)).toBe("metre");
    expect(resolvePublicBrand(42)).toBe("metre");
    expect(() => resolvePublicBrand({ brand: "mareliure" })).not.toThrow();
  });
});
