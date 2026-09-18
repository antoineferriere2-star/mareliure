import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const brand = vi.hoisted(() => ({ isMaReliure: true }));
vi.mock("@/brand", () => ({
  get isMaReliure() {
    return brand.isMaReliure;
  },
}));

const { baseUrlFor } = await import("./robots[.]txt");

beforeEach(() => {
  brand.isMaReliure = true;
  vi.unstubAllEnvs();
});
afterEach(() => vi.unstubAllEnvs());

describe("baseUrlFor (robots.txt)", () => {
  it("pointe vers metre-pro.com sur le déploiement Métré", () => {
    brand.isMaReliure = false;
    expect(baseUrlFor("finebindery.com")).toBe("https://metre-pro.com");
  });

  it("pointe vers mareliure.fr sur mareliure.fr", () => {
    expect(baseUrlFor("www.mareliure.fr")).toBe("https://mareliure.fr");
  });

  it("pointe vers finebindery.com sur finebindery.com — jamais mareliure.fr", () => {
    expect(baseUrlFor("finebindery.com")).toBe("https://finebindery.com");
  });

  it("respecte MARKETPLACE_BRAND_OVERRIDE", () => {
    vi.stubEnv("MARKETPLACE_BRAND_OVERRIDE", "FINE_BINDERY");
    expect(baseUrlFor("localhost:8080")).toBe("https://finebindery.com");
  });
});
