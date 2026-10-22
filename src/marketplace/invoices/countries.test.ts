import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { countryZone, normalizeCountry } from "./countries";
import { COUNTRY_NAME_TO_CODE } from "./countryNames";
import { todayInParis } from "@/marketplace/quotes/quoteStatus";

afterEach(() => vi.restoreAllMocks());

describe("pays : correspondance exacte", () => {
  it("convertit codes et noms exacts en français et en anglais, sans casse ni espaces de bord", () => {
    expect(["fr", " France ", "Belgique", "belgium", "Royaume-Uni", "United  Kingdom", "États-Unis", "USA", "Suisse", "Deutschland"].map(normalizeCountry))
      .toEqual(["FR", "FR", "BE", "BE", "GB", "GB", "US", "US", "CH", "DE"]);
  });
  it("ne devine jamais : une valeur inconnue est rendue telle quelle et journalisée", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(normalizeCountry("Belgiqe")).toBe("Belgiqe");
    expect(normalizeCountry("Bretagne")).toBe("Bretagne");
    expect(warn).toHaveBeenCalledWith(JSON.stringify({ event: "country_not_normalized", value: "Belgiqe" }));
  });
  it("déduit la zone du code", () => {
    expect([countryZone("FR"), countryZone("BE"), countryZone("CH"), countryZone(null)]).toEqual(["france", "eu", "outside_eu", "france"]);
  });
  it("la migration embarque exactement la même table", () => {
    const sql = readFileSync(new URL("../../../supabase/migrations/20261023100000_einvoicing_phase1.sql", import.meta.url), "utf8");
    const block = sql.slice(sql.indexOf("INSERT INTO marketplace_country_names"), sql.indexOf("CREATE OR REPLACE FUNCTION pg_temp.marketplace_country_code"));
    const pairs = Object.fromEntries([...block.matchAll(/\('((?:[^']|'')+)','([A-Z]{2})'\)/g)].map((m) => [m[1].replace(/''/g, "'"), m[2]]));
    expect(pairs).toEqual(COUNTRY_NAME_TO_CODE);
  });
});

describe("date du jour à Paris", () => {
  it("le 31 décembre à 23 h 30 UTC est le 1er janvier", () => {
    expect(todayInParis(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
    expect(todayInParis(new Date("2026-07-31T21:59:00Z"))).toBe("2026-07-31");
    expect(todayInParis(new Date("2026-07-31T22:00:00Z"))).toBe("2026-08-01");
  });
});
