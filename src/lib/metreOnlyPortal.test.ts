import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("l'Espace Client Métré Build sur le déploiement Ma Reliure", () => {
  it("/portal est introuvable : la garde metreOnly ouvre son beforeLoad", () => {
    const route = read("src/routes/_authenticated/portal/route.tsx");
    expect(route).toMatch(/beforeLoad: async \(\) => \{[\s\S]{0,400}?metreOnly\(\);/);
  });

  it("le serveur refuse d'y provisionner un espace Métré", () => {
    expect(read("src/build/services/provisionWorkspace.functions.ts")).toContain("if (isMaReliure) fail(404,");
  });
});
