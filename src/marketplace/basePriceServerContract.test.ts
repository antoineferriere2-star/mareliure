import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  resolve(process.cwd(), "src/marketplace/services/pricing.data.functions.ts"),
  "utf8",
);

describe("accès serveur aux tarifs de base", () => {
  it("réserve lecture et écriture aux administrateurs", () => {
    for (const operation of ["getBasePriceReference", "saveBasePrice"]) {
      const start = SOURCE.indexOf(`export const ${operation}`);
      const next = SOURCE.indexOf("export const ", start + 1);
      const body = SOURCE.slice(start, next === -1 ? undefined : next);
      expect(body).toContain("requireSupabaseAuth");
      expect(body).toContain("assertAdmin");
    }
  });

  it("versionne une écriture au lieu de modifier une ligne existante", () => {
    const start = SOURCE.indexOf("export const saveBasePrice");
    const body = SOURCE.slice(start);
    expect(body).toContain('.update({ status: "retired", updated_at: now })');
    expect(body).toContain("version: ((previous as { version: number } | null)?.version ?? 0) + 1");
    expect(body).toContain('.insert({');
  });
});
