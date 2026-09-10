/**
 * La photographie d'un prix de dossier : figée, justifiée quand elle s'écarte
 * de la grille, et indifférente à ce que la grille devient ensuite.
 */
import { describe, expect, it } from "vitest";
import { priceProject } from "./pricing.engine";
import { draft, entry, grid } from "./pricingGrid.fixtures";
import { buildPricingSnapshot } from "./snapshot";

const request = {
  lines: [{ workItemKey: "plein_cuir", quantity: 1 }],
  sizeClass: "standard" as const,
  complexityClass: "standard" as const,
};

function snapshotOf(
  composition: ReturnType<typeof priceProject>,
  retained: { price: number; payout: number; reason?: string },
) {
  return buildPricingSnapshot({
    composition,
    retainedPriceTtcCents: retained.price,
    retainedPayoutCents: retained.payout,
    vatRateBps: 2_000,
    overrideReason: retained.reason ?? null,
    priceIncludes: [],
    ruleVersion: "test",
  });
}

describe("un prix de dossier conforme à la grille", () => {
  it("se fige sans justification, au prix validé de la grille", () => {
    const composition = priceProject(
      request,
      grid([entry({ workItemKey: "plein_cuir", priceTtcCents: 59_000 })]),
    );
    const { snapshot, errors } = snapshotOf(composition, {
      price: 59_000,
      payout: composition.payout!.payoutCents!,
    });
    expect(errors).toEqual([]);
    expect(snapshot).toMatchObject({
      provenance: "ADMIN_VALIDATED",
      overridden: false,
      priceTtcCents: 59_000,
      priceHtCents: 49_167,
      payoutCents: 36_800,
    });
  });

  it("ne bouge pas quand la grille change ensuite", () => {
    const entries = [entry({ workItemKey: "plein_cuir", priceTtcCents: 59_000 })];
    const composition = priceProject(request, grid(entries));
    const { snapshot } = snapshotOf(composition, {
      price: 59_000,
      payout: composition.payout!.payoutCents!,
    });

    // Ma Reliure passe le plein cuir à 650 € : le dossier validé garde 590 €.
    entries[0].priceTtcCents = 65_000;
    composition.lines[0].priceTtcCents = 65_000;
    const later = priceProject(request, grid(entries));

    expect(later.priceTtcCents).toBe(65_000);
    expect(snapshot!.priceTtcCents).toBe(59_000);
    expect(snapshot!.operations[0].priceTtcCents).toBe(59_000);
  });
});

describe("un prix fixé sur le dossier", () => {
  const composition = priceProject(
    request,
    grid([entry({ workItemKey: "plein_cuir", priceTtcCents: 59_000 })]),
  );

  it("grille 590 €, décidé 650 € client et 480 € atelier : prix du dossier, justifié", () => {
    expect(snapshotOf(composition, { price: 65_000, payout: 48_000 }).errors[0]).toContain(
      "pourquoi",
    );
    const { snapshot } = snapshotOf(composition, {
      price: 65_000,
      payout: 48_000,
      reason: "Cuir fourni par le client, dorure plus riche.",
    });
    expect(snapshot).toMatchObject({
      provenance: "CASE_OVERRIDE",
      overridden: true,
      priceTtcCents: 65_000,
      payoutCents: 48_000,
      composed: { priceTtcCents: 59_000 },
    });
    // La marge se lit sur le HT : 541,67 € HT − 480 € = 61,67 €.
    expect(snapshot!.margin.marginCents).toBe(6_167);
  });

  it("refuse une rémunération supérieure au prix HT", () => {
    expect(
      snapshotOf(composition, { price: 59_000, payout: 50_000, reason: "x" }).errors[0],
    ).toContain("ne peut pas dépasser");
  });

  it("un projet que la grille ne chiffre pas se chiffre à la main, avec sa raison", () => {
    const unpriced = priceProject(request, grid([]));
    expect(snapshotOf(unpriced, { price: 60_000, payout: 40_000 }).snapshot).toBeNull();
    expect(
      snapshotOf(unpriced, { price: 60_000, payout: 40_000, reason: "Étude en atelier." })
        .snapshot?.provenance,
    ).toBe("CASE_OVERRIDE");
  });
});

describe("une référence initiale non validée", () => {
  it("n'est pas promise à un client sans décision écrite", () => {
    const composition = priceProject(
      request,
      grid([draft({ workItemKey: "plein_cuir", priceTtcCents: 59_000 })]),
    );
    const payout = composition.payout!.payoutCents!;
    const refused = snapshotOf(composition, { price: 59_000, payout });
    expect(refused.snapshot).toBeNull();
    expect(refused.errors[0]).toContain("non validé");

    const justified = snapshotOf(composition, {
      price: 59_000,
      payout,
      reason: "Tarif relu pour ce dossier.",
    });
    expect(justified.snapshot).toMatchObject({ provenance: "CASE_OVERRIDE", overridden: false });
  });
});
