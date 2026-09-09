import { describe, expect, it } from "vitest";
import {
  aggregateRates,
  isPublishableRange,
  PUBLISHABLE_MINIMUM_REFERENCES,
  QUARTILE_MINIMUM_REFERENCES,
  validateRate,
  type BinderRate,
} from "./rateCard";
import { asVerified, TEST_RATES } from "./testReferences.fixture";

type Rate = BinderRate & { binderName: string };

function rate(overrides: Partial<Rate> & { binderId: string; typicalPayoutCents: number }): Rate {
  return {
    id: `r-${overrides.binderId}-${overrides.typicalPayoutCents}`,
    binderName: `Atelier ${overrides.binderId}`,
    workItemKey: "demi_cuir",
    minimumPayoutCents: overrides.typicalPayoutCents - 3_000,
    maximumPayoutCents: overrides.typicalPayoutCents + 5_000,
    estimatedHours: null,
    sizeClass: "standard",
    complexityClass: "standard",
    notes: null,
    effectiveFrom: "2026-09-01",
    status: "active",
    source: "binder_interview",
    provenance: "REAL_VERIFIED",
    verifiedAt: null,
    verifiedBy: null,
    ...overrides,
  };
}

const verified = asVerified(TEST_RATES);

describe("l'agrégation des grilles", () => {
  it("donne le cas de référence : 3 ateliers, 320 / 350 / 410 €", () => {
    const aggregate = aggregateRates(verified, "demi_cuir", "standard", "standard");

    expect(aggregate).not.toBeNull();
    expect(aggregate!.referenceCount).toBe(3);
    expect(aggregate!.minimumCents).toBe(32_000);
    expect(aggregate!.medianCents).toBe(35_000);
    expect(aggregate!.maximumCents).toBe(41_000);
    expect(aggregate!.contributions.map((c) => c.typicalPayoutCents)).toEqual([
      32_000, 35_000, 41_000,
    ]);
  });

  /**
   * La distinction qui a failli passer inaperçue. Les trois statistiques
   * portent sur **une seule quantité**, le tarif courant, et répondent à « que
   * demande le métier ». Le plancher et le plafond mêlent deux dispersions —
   * entre ateliers et à l'intérieur de chacun — et ne veulent rien dire comme
   * statistique ; ils bornent une estimation, c'est tout.
   *
   * Les confondre donnait « minimum 300 € » là où aucun atelier ne demande
   * 300 € pour ce travail.
   */
  it("ne confond pas la dispersion entre ateliers et l'enveloppe déclarée", () => {
    const aggregate = aggregateRates(verified, "demi_cuir", "standard", "standard")!;

    // Trois statistiques sur le tarif courant.
    expect([aggregate.minimumCents, aggregate.medianCents, aggregate.maximumCents]).toEqual([
      32_000, 35_000, 41_000,
    ]);
    // L'enveloppe, plus large, et nommée autrement.
    expect(aggregate.floorCents).toBe(30_000);
    expect(aggregate.ceilingCents).toBe(47_000);
    expect(aggregate.floorCents).toBeLessThan(aggregate.minimumCents);
    expect(aggregate.ceilingCents).toBeGreaterThan(aggregate.maximumCents);
  });

  /**
   * Sans cette règle, le relieur le plus bavard fixerait le prix du marché :
   * trois lignes saisies chez lui pèseraient trois voix dans la médiane.
   */
  it("ne compte qu'une voix par atelier, la plus récente", () => {
    const aggregate = aggregateRates(
      [
        rate({ binderId: "a", typicalPayoutCents: 20_000, effectiveFrom: "2025-01-01" }),
        rate({ binderId: "a", typicalPayoutCents: 90_000, effectiveFrom: "2026-06-01" }),
        rate({ binderId: "b", typicalPayoutCents: 40_000 }),
        rate({ binderId: "c", typicalPayoutCents: 50_000 }),
      ],
      "demi_cuir",
      "standard",
      "standard",
    );

    expect(aggregate!.referenceCount).toBe(3);
    expect(aggregate!.contributions.map((c) => c.typicalPayoutCents)).toEqual([
      40_000, 50_000, 90_000,
    ]);
    expect(aggregate!.medianCents).toBe(50_000);
  });

  /**
   * Un prix décidé par Ma Reliure n'est pas une observation du marché.
   * L'inclure reviendrait à se citer soi-même comme source.
   */
  it("n'agrège que le terrain, jamais nos propres décisions", () => {
    const aggregate = aggregateRates(
      [
        rate({ binderId: "a", typicalPayoutCents: 30_000 }),
        rate({ binderId: "b", typicalPayoutCents: 90_000, provenance: "ADMIN_VALIDATED" }),
        rate({ binderId: "c", typicalPayoutCents: 90_000, provenance: "PLACEHOLDER" }),
        rate({ binderId: "d", typicalPayoutCents: 90_000, provenance: "TEST_ONLY" }),
      ],
      "demi_cuir",
      "standard",
      "standard",
    );

    expect(aggregate!.referenceCount).toBe(1);
    expect(aggregate!.medianCents).toBe(30_000);
  });

  it("ignore les lignes remplacées et les brouillons", () => {
    const aggregate = aggregateRates(
      [
        rate({ binderId: "a", typicalPayoutCents: 30_000 }),
        rate({ binderId: "b", typicalPayoutCents: 99_000, status: "superseded" }),
        rate({ binderId: "c", typicalPayoutCents: 99_000, status: "draft" }),
      ],
      "demi_cuir",
      "standard",
      "standard",
    );
    expect(aggregate!.referenceCount).toBe(1);
  });

  it("ne rend rien plutôt qu'un agrégat vide", () => {
    expect(aggregateRates(verified, "plein_cuir", "standard", "standard")).toBeNull();
    expect(aggregateRates(verified, "demi_cuir", "oversize", "standard")).toBeNull();
  });

  /**
   * Un « premier quartile » calculé sur trois valeurs est une précision
   * inventée : il donne l'apparence d'une statistique là où il n'y a qu'un avis.
   */
  it("ne publie de quartiles qu'au-delà de cinq ateliers", () => {
    const few = aggregateRates(verified, "demi_cuir", "standard", "standard");
    expect(few!.q1Cents).toBeNull();
    expect(few!.q3Cents).toBeNull();

    const many = aggregateRates(
      Array.from({ length: QUARTILE_MINIMUM_REFERENCES }, (_, i) =>
        rate({ binderId: `b${i}`, typicalPayoutCents: 30_000 + i * 5_000 }),
      ),
      "demi_cuir",
      "standard",
      "standard",
    );
    expect(many!.referenceCount).toBe(QUARTILE_MINIMUM_REFERENCES);
    expect(many!.q1Cents).not.toBeNull();
    expect(many!.q3Cents).not.toBeNull();
  });

  it("mesure la dispersion pour que la confiance puisse en tenir compte", () => {
    const tight = aggregateRates(
      [
        rate({ binderId: "a", typicalPayoutCents: 34_000 }),
        rate({ binderId: "b", typicalPayoutCents: 35_000 }),
        rate({ binderId: "c", typicalPayoutCents: 36_000 }),
      ],
      "demi_cuir",
      "standard",
      "standard",
    );
    const spread = aggregateRates(
      [
        rate({ binderId: "a", typicalPayoutCents: 10_000 }),
        rate({ binderId: "b", typicalPayoutCents: 35_000 }),
        rate({ binderId: "c", typicalPayoutCents: 90_000 }),
      ],
      "demi_cuir",
      "standard",
      "standard",
    );
    expect(spread!.dispersionBps).toBeGreaterThan(tight!.dispersionBps);
  });

  it("ne publie une fourchette qu'à partir de trois ateliers", () => {
    expect(PUBLISHABLE_MINIMUM_REFERENCES).toBe(3);
    expect(isPublishableRange(null)).toBe(false);
    expect(
      isPublishableRange(
        aggregateRates(
          [
            rate({ binderId: "a", typicalPayoutCents: 30_000 }),
            rate({ binderId: "b", typicalPayoutCents: 40_000 }),
          ],
          "demi_cuir",
          "standard",
          "standard",
        ),
      ),
    ).toBe(false);
    expect(isPublishableRange(aggregateRates(verified, "demi_cuir", "standard", "standard"))).toBe(
      true,
    );
  });
});

describe("la saisie d'une ligne de grille", () => {
  it("accepte une ligne cohérente", () => {
    expect(
      validateRate({
        minimumPayoutCents: 30_000,
        typicalPayoutCents: 35_000,
        maximumPayoutCents: 42_000,
      }),
    ).toEqual([]);
  });

  it("refuse un ordre impossible et un montant nul", () => {
    expect(
      validateRate({
        minimumPayoutCents: 40_000,
        typicalPayoutCents: 35_000,
        maximumPayoutCents: 42_000,
      }),
    ).not.toEqual([]);
    expect(
      validateRate({
        minimumPayoutCents: 0,
        typicalPayoutCents: 35_000,
        maximumPayoutCents: 42_000,
      }),
    ).not.toEqual([]);
  });
});
