import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BINDER_OFFER_COLUMNS } from "./services/marketplace.data.functions";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const PRICE_FIELDS = /customer_price|customer_service_price|customer_total|gross_margin|amount_cents|margin_floor|contribution_floor/;

describe("ce qu'un atelier reçoit du serveur", () => {
  it("ne contient jamais le prix de vente au client ni la marge d'Oppe", () => {
    expect(BINDER_OFFER_COLUMNS).not.toMatch(PRICE_FIELDS);
    expect(BINDER_OFFER_COLUMNS).toContain("binder_payout_cents");
  });

  it("lit les offres de l'atelier uniquement par cette liste de colonnes", () => {
    const source = read("src/marketplace/services/marketplace.data.functions.ts");
    const reads = [...source.matchAll(/\.from\("marketplace_quotes"\)\s*\.select\(\s*([^)]+)\)/g)];
    let binderReads = 0;
    for (const read of reads) {
      // La fonction qui contient la lecture : soit réservée à l'administration, soit atelier.
      const before = source.slice(0, read.index);
      const fn = source.slice(before.lastIndexOf("export const "), read.index);
      if (fn.includes("assertAdmin(")) continue;
      binderReads += 1;
      expect(read[1]).toContain("BINDER_OFFER_COLUMNS");
      expect(read[1]).not.toMatch(PRICE_FIELDS);
    }
    expect(binderReads).toBeGreaterThanOrEqual(2);
  });

  it.each([
    "src/marketplace/services/binderWorks.server.ts",
    "src/marketplace/services/binderQuotes.server.ts",
    "src/marketplace/services/binderCaseWorkspace.data.functions.ts",
    "src/marketplace/services/caseLogistics.server.ts",
    "src/marketplace/services/workshopAccess.server.ts",
  ])("%s ne lit aucun prix client", (path) => {
    expect(read(path)).not.toMatch(PRICE_FIELDS);
  });
});
