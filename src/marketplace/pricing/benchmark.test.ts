/**
 * Le benchmark web : un repère, et rien de plus.
 */
import { describe, expect, it } from "vitest";
import { aggregateBenchmarks, benchmarkAggregatesFrom, validateBenchmark } from "./benchmark";
import {
  canReachCustomer,
  countsAsReference,
  isPublicProvenance,
  PRICE_PROVENANCES,
  RATE_PROVENANCES,
  rateProvenanceFor,
} from "./provenance";
import { benchmarkRow } from "./pricingConsole.fixtures";

describe("la provenance WEB_BENCHMARK", () => {
  it("n'atteint jamais un client, ne fait jamais référence, n'est jamais publique", () => {
    expect(canReachCustomer("WEB_BENCHMARK")).toBe(false);
    expect(countsAsReference("WEB_BENCHMARK")).toBe(false);
    expect(isPublicProvenance("WEB_BENCHMARK")).toBe(false);
  });

  it("ne peut pas être portée par une grille d'atelier", () => {
    expect(RATE_PROVENANCES).not.toContain("WEB_BENCHMARK");
    expect(RATE_PROVENANCES.length).toBe(PRICE_PROVENANCES.length - 1);
  });

  it("seul le prix arrêté par Ma Reliure est publiable", () => {
    expect(PRICE_PROVENANCES.filter(isPublicProvenance)).toEqual(["ADMIN_VALIDATED"]);
  });
});

describe("la provenance d'une ligne de grille", () => {
  it("ne se prétend plus validée quand personne ne l'a confirmée", () => {
    expect(rateProvenanceFor({ verified: false, source: "binder_interview" })).toBe(
      "BINDER_DECLARED",
    );
    expect(rateProvenanceFor({ verified: false, source: "admin_entry" })).toBe("BINDER_DECLARED");
    expect(canReachCustomer("BINDER_DECLARED")).toBe(false);
    expect(countsAsReference("BINDER_DECLARED")).toBe(false);
  });

  it("devient une référence une fois entendue, ou payée", () => {
    expect(rateProvenanceFor({ verified: true, source: "binder_interview" })).toBe("REAL_VERIFIED");
    expect(rateProvenanceFor({ verified: false, source: "historical_order" })).toBe(
      "HISTORICAL_TRANSACTION",
    );
    expect(countsAsReference("HISTORICAL_TRANSACTION")).toBe(true);
  });
});

describe("l'agrégation des repères", () => {
  it("donne une voix par source, et prend la médiane des milieux de fourchette", () => {
    const rows = [
      // Une source qui publie deux formats de la même classe ne pèse qu'une fois.
      benchmarkRow({ sourceUrl: "https://a.example", lowPriceCents: 8_000, highPriceCents: 9_000 }),
      benchmarkRow({
        sourceUrl: "https://a.example",
        lowPriceCents: 9_000,
        highPriceCents: 12_000,
      }),
      benchmarkRow({
        sourceUrl: "https://b.example",
        lowPriceCents: 12_000,
        highPriceCents: 12_000,
      }),
      benchmarkRow({
        sourceUrl: "https://c.example",
        lowPriceCents: 20_000,
        highPriceCents: 30_000,
      }),
    ];
    const aggregate = aggregateBenchmarks(
      rows,
      "demi_cuir",
      "standard",
      null,
      new Date("2026-09-10"),
    )!;
    expect(aggregate.sourceCount).toBe(3);
    // Milieux : a = (80 + 120) / 2 = 100 ; b = 120 ; c = 250 → médiane 120 €.
    expect(aggregate.medianCents).toBe(12_000);
    expect(aggregate.lowCents).toBe(8_000);
    expect(aggregate.highCents).toBe(30_000);
  });

  it("ne calcule de quartiles qu'à partir de cinq sources", () => {
    const rows = (count: number) =>
      Array.from({ length: count }, (_, index) =>
        benchmarkRow({
          sourceUrl: `https://s${index}.example`,
          lowPriceCents: 10_000 + index * 1_000,
          highPriceCents: 10_000 + index * 1_000,
        }),
      );
    expect(aggregateBenchmarks(rows(4), "demi_cuir", "standard", null)!.q1Cents).toBeNull();
    const five = aggregateBenchmarks(rows(5), "demi_cuir", "standard", null)!;
    expect(five.q1Cents).toBe(11_000);
    expect(five.q3Cents).toBe(13_000);
  });

  it("ne mélange pas un prix « tous formats » avec un format précis", () => {
    const rows = [
      benchmarkRow({ sizeClass: null }),
      benchmarkRow({ sizeClass: "standard", sourceUrl: "https://b.example" }),
    ];
    expect(aggregateBenchmarks(rows, "demi_cuir", "standard", null)!.sourceCount).toBe(1);
    expect(aggregateBenchmarks(rows, "demi_cuir", null, null)!.sourceCount).toBe(1);
    expect(benchmarkAggregatesFrom(rows)).toHaveLength(2);
  });

  it("signale les bases mêlées et les relevés anciens", () => {
    const rows = [
      benchmarkRow({ priceBasis: "TTC", observedAt: "2023-01-01" }),
      benchmarkRow({ priceBasis: "NOT_STATED", sourceUrl: "https://b.example" }),
    ];
    const aggregate = aggregateBenchmarks(
      rows,
      "demi_cuir",
      "standard",
      null,
      new Date("2026-09-10"),
    )!;
    expect(aggregate.bases).toEqual(["TTC", "NOT_STATED"]);
    expect(aggregate.stale).toBe(true);
  });

  it("ignore les relevés retirés", () => {
    expect(
      aggregateBenchmarks([benchmarkRow({ status: "retired" })], "demi_cuir", "standard", null),
    ).toBeNull();
  });
});

describe("la saisie d'un repère", () => {
  const valid = {
    lowPriceCents: 10_000,
    highPriceCents: 12_000,
    sourceName: "Atelier",
    sourceUrl: "https://atelier.example/tarifs",
    sourceExcerpt: "Demi-cuir 100 à 120 €",
    observedAt: "2026-09-10",
  };

  it("exige une page, un extrait et une date passée", () => {
    const now = new Date("2026-09-10T12:00:00Z");
    expect(validateBenchmark(valid, now)).toEqual([]);
    expect(validateBenchmark({ ...valid, sourceUrl: "atelier" }, now)).not.toEqual([]);
    expect(validateBenchmark({ ...valid, sourceExcerpt: " " }, now)).not.toEqual([]);
    expect(validateBenchmark({ ...valid, observedAt: "2027-01-01" }, now)).not.toEqual([]);
    expect(validateBenchmark({ ...valid, lowPriceCents: 13_000 }, now)).not.toEqual([]);
    expect(validateBenchmark({ ...valid, lowPriceCents: 99.5 }, now)).not.toEqual([]);
  });
});
