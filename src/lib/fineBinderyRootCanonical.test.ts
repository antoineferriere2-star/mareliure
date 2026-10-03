import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("la racine de finebindery.com", () => {
  it("déclare /en pour adresse canonique : même page, une seule adresse indexée", () => {
    const route = readFileSync(resolve(process.cwd(), "src/routes/index.tsx"), "utf8");
    expect(route).toContain("const canonical = `${MARKETPLACE_BRAND_CONFIGS.FINE_BINDERY.seo.canonicalOrigin}/en`;");
  });
});
