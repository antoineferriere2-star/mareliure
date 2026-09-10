/**
 * Publier un prix, figer un dossier, annoncer un prix au public.
 */
import { describe, expect, it } from "vitest";
import { composePrice } from "./composition";
import { pricebookHistory } from "./pricebook";
import { preparePricebookEntry, type PricebookInput } from "./pricebookInput";
import { formatPublicPrice, publicPriceRows } from "./publicPrices";
import { buildPricingSnapshot } from "./snapshot";
import { POLICY, pricebookEntry } from "./pricingConsole.fixtures";
import { formatEuros } from "./money";

const input = (overrides: Partial<PricebookInput> = {}): PricebookInput => ({
  workItemKey: "demi_cuir",
  sizeClass: "standard",
  complexityClass: "standard",
  pricingMode: "FIXED",
  referenceBinderPayoutCents: 30_000,
  customerPriceHtCents: 40_000,
  priceHtHighCents: null,
  unitLabel: null,
  vatRateBps: 2_000,
  targetMarginBps: 1_800,
  minimumMarginCents: null,
  includedWorkItems: [],
  publicVisible: false,
  changeReason: null,
  ...overrides,
});
const firstVersion = { hasPreviousVersion: false, policyMinimumMarginCents: 2_000 };

describe("la publication d'une entrée", () => {
  it("calcule le TTC une seule fois, à partir du HT", () => {
    const prepared = preparePricebookEntry(input(), firstVersion);
    expect(prepared.errors).toEqual([]);
    expect(prepared.customerPriceTtcCents).toBe(48_000);
  });

  it("ne bloque jamais sur la marge : elle informe", () => {
    const prepared = preparePricebookEntry(
      input({ referenceBinderPayoutCents: 39_000, minimumMarginCents: 8_000 }),
      firstVersion,
    );
    expect(prepared.errors).toEqual([]);
    expect(prepared.margin?.status).toBe("ALERTE");
  });

  it("refuse les incohérences structurelles", () => {
    expect(
      preparePricebookEntry(input({ referenceBinderPayoutCents: 50_000 }), firstVersion).errors,
    ).not.toEqual([]);
    expect(preparePricebookEntry(input({ pricingMode: "RANGE" }), firstVersion).errors).not.toEqual(
      [],
    );
    expect(
      preparePricebookEntry(input({ priceHtHighCents: 50_000 }), firstVersion).errors,
    ).not.toEqual([]);
    expect(
      preparePricebookEntry(input({ pricingMode: "PER_UNIT" }), firstVersion).errors,
    ).not.toEqual([]);
    expect(
      preparePricebookEntry(input({ includedWorkItems: ["demi_cuir"] }), firstVersion).errors,
    ).not.toEqual([]);
    expect(
      preparePricebookEntry(
        input({ includedWorkItems: ["restauration_patrimoniale"] }),
        firstVersion,
      ).errors,
    ).not.toEqual([]);
  });

  it("n'accepte qu'une entrée « sur étude », sans montant ni publicité, pour un travail sur étude", () => {
    expect(
      preparePricebookEntry(input({ workItemKey: "reliure_de_creation" }), firstVersion).errors,
    ).not.toEqual([]);
    const study = preparePricebookEntry(
      input({
        workItemKey: "reliure_de_creation",
        pricingMode: "MANUAL_REVIEW",
        referenceBinderPayoutCents: null,
        customerPriceHtCents: null,
      }),
      firstVersion,
    );
    expect(study.errors).toEqual([]);
    expect(study.customerPriceTtcCents).toBeNull();
    expect(
      preparePricebookEntry(
        input({
          pricingMode: "MANUAL_REVIEW",
          referenceBinderPayoutCents: null,
          customerPriceHtCents: null,
          publicVisible: true,
        }),
        firstVersion,
      ).errors,
    ).not.toEqual([]);
  });

  it("exige la raison d'un changement dès la deuxième version", () => {
    const context = { hasPreviousVersion: true, policyMinimumMarginCents: 2_000 };
    expect(preparePricebookEntry(input(), context).errors).toContain(
      "Modifier un prix publié demande d'en dire la raison.",
    );
    expect(
      preparePricebookEntry(input({ changeReason: "Trois ateliers relevés" }), context).errors,
    ).toEqual([]);
  });

  it("garde l'historique, de la version en vigueur à la première", () => {
    const entries = [
      pricebookEntry({ version: 1, status: "retired" }),
      pricebookEntry({ version: 3, status: "published", changeReason: "Hausse du cuir" }),
      pricebookEntry({ version: 2, status: "retired", changeReason: "Premier atelier" }),
      pricebookEntry({ workItemKey: "plein_cuir", version: 7 }),
    ];
    expect(
      pricebookHistory(entries, "demi_cuir", "standard", "standard").map((entry) => entry.version),
    ).toEqual([3, 2, 1]);
  });
});

describe("la photographie d'un prix validé", () => {
  const composition = composePrice({
    lines: [{ workItemKey: "demi_cuir", quantity: 1 }],
    sizeClass: "standard",
    complexityClass: "standard",
    entries: [pricebookEntry({ id: "entry-demi-cuir", version: 4 })],
    modifiers: [],
    policy: POLICY,
  });
  const confidence = { level: "BINDERS_SEVERAL" as const, label: "3 à 5 ateliers", alerts: [] };
  const snapshotInput = {
    composition,
    retainedPayoutCents: 30_000,
    retainedPriceHtCents: 40_000,
    vatRateBps: 2_000,
    policy: POLICY,
    confidence,
    overrideReason: null,
    priceIncludes: ["Reliure"],
    ruleVersion: "test",
  };

  it("fige version, opérations, HT, TVA, TTC, marge et confiance", () => {
    const { snapshot, errors } = buildPricingSnapshot(snapshotInput);
    expect(errors).toEqual([]);
    expect(snapshot).toMatchObject({
      pricebookVersions: [{ entryId: "entry-demi-cuir", version: 4, workItemKey: "demi_cuir" }],
      payoutCents: 30_000,
      priceHtCents: 40_000,
      vatCents: 8_000,
      priceTtcCents: 48_000,
      margin: { status: "OK", marginCents: 10_000 },
      confidence: { level: "BINDERS_SEVERAL" },
      overridden: false,
    });
    expect(snapshot!.operations[0]).toMatchObject({ workItemKey: "demi_cuir", entryVersion: 4 });
  });

  it("ne partage aucune référence avec la composition qui l'a produite", () => {
    const { snapshot } = buildPricingSnapshot(snapshotInput);
    composition.lines[0].priceHtCents = 1;
    expect(snapshot!.operations[0].priceHtCents).toBe(40_000);
    composition.lines[0].priceHtCents = 40_000;
  });

  it("exige une raison pour s'écarter du Pricebook", () => {
    const { snapshot, errors } = buildPricingSnapshot({
      ...snapshotInput,
      retainedPriceHtCents: 45_000,
    });
    expect(snapshot).toBeNull();
    expect(errors[0]).toContain("s'écarte du Pricebook");

    const justified = buildPricingSnapshot({
      ...snapshotInput,
      retainedPriceHtCents: 45_000,
      overrideReason: "Cuir fourni par le client",
    });
    expect(justified.snapshot?.overridden).toBe(true);
    expect(justified.snapshot?.composed?.priceHtCents).toBe(40_000);
  });

  it("exige une raison pour un prix fixé à la main quand le Pricebook ne chiffre pas", () => {
    const abstained = composePrice({
      ...composition,
      lines: [{ workItemKey: "nerfs", quantity: 1 }],
      entries: [],
      modifiers: [],
      policy: POLICY,
    });
    expect(buildPricingSnapshot({ ...snapshotInput, composition: abstained }).snapshot).toBeNull();
    const manual = buildPricingSnapshot({
      ...snapshotInput,
      composition: abstained,
      overrideReason: "Après étude en atelier",
    });
    expect(manual.snapshot?.composed).toBeNull();
    expect(manual.snapshot?.overridden).toBe(true);
  });

  it("ne bloque pas sur la marge, mais la fige", () => {
    const { snapshot } = buildPricingSnapshot({
      ...snapshotInput,
      retainedPayoutCents: 39_500,
      overrideReason: "Geste commercial",
    });
    expect(snapshot?.margin.status).toBe("ALERTE");
  });

  it("refuse une rémunération au-dessus du prix", () => {
    expect(
      buildPricingSnapshot({ ...snapshotInput, retainedPayoutCents: 41_000, overrideReason: "x" })
        .errors,
    ).not.toEqual([]);
  });
});

describe("les prix publics", () => {
  it("ne montrent que les entrées publiées, validées et cochées publiques", () => {
    const rows = publicPriceRows([
      pricebookEntry({ workItemKey: "demi_cuir", publicVisible: true }),
      pricebookEntry({ workItemKey: "pleine_toile", publicVisible: false }),
      pricebookEntry({ workItemKey: "plein_cuir", publicVisible: true, status: "retired" }),
      pricebookEntry({ workItemKey: "dos_cuir", publicVisible: true, status: "draft" }),
      pricebookEntry({ workItemKey: "demi_toile", publicVisible: true, validatedAt: null }),
      pricebookEntry({
        workItemKey: "etui",
        publicVisible: true,
        pricingMode: "MANUAL_REVIEW",
        customerPriceCents: null,
        referenceBinderPayoutCents: null,
        customerPriceTtcCents: null,
      }),
      pricebookEntry({ workItemKey: "reliure_de_creation", publicVisible: true }),
    ]);
    expect(rows.map((row) => row.workItemKey)).toEqual(["demi_cuir"]);
  });

  it("ne portent ni rémunération, ni marge, ni prix HT", () => {
    const [row] = publicPriceRows([pricebookEntry({ publicVisible: true })]);
    expect(Object.keys(row).sort()).toEqual(
      [
        "complexityClass",
        "label",
        "mode",
        "priceTtcCents",
        "priceTtcHighCents",
        "sizeClass",
        "unitLabel",
        "workItemKey",
      ].sort(),
    );
    expect(row.priceTtcCents).toBe(48_000);
  });

  it("s'écrivent comme on les lit", () => {
    const [range] = publicPriceRows([
      pricebookEntry({ publicVisible: true, pricingMode: "RANGE", priceHtHighCents: 50_000 }),
    ]);
    expect(range.priceTtcHighCents).toBe(60_000);
    const text = formatPublicPrice(range, formatEuros).replace(/\s/g, " ");
    expect(text).toMatch(/480,00 € – 600,00 €/);
    const [unit] = publicPriceRows([
      pricebookEntry({
        workItemKey: "dorure_fleurons",
        publicVisible: true,
        pricingMode: "PER_UNIT",
        unitLabel: "par fleuron",
        customerPriceTtcCents: 720,
      }),
    ]);
    expect(formatPublicPrice(unit, formatEuros).replace(/\s/g, " ")).toMatch(/7,20 € par fleuron/);
  });
});
