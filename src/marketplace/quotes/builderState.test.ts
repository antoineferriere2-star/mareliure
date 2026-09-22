import { describe, expect, it } from "vitest";
import { emptyBuilder, stateFromDocument, toQuoteInput, totalsOf, type BuilderState } from "./builderState";
import { buildQuoteRows, EMPTY_BILLING_PROFILE } from "./quoteBuild";
import { freeLine, lineFromBasePrice, lineFromService, type CatalogService } from "./quoteLines";
import { quoteView, type QuoteDbRow } from "./quoteViews";

const service = (name: string, cents: number, id: string): CatalogService => ({ id, categoryId: null, name, description: null, unitPriceCents: cents, vatRateBps: null, unit: null });
const ID = (n: number) => `8d7a8c8e-6c53-4a1c-9a36-0d1f3c0d8a${String(n).padStart(2, "0")}`;

function scenario(): BuilderState {
  const lines = [
    lineFromService(service("Plein cuir", 28000, ID(1)), 2000, "a"),
    lineFromService(service("Nerfs", 3000, ID(2)), 2000, "b"),
    lineFromService(service("Dorure titre", 4500, ID(3)), 2000, "c"),
    lineFromService(service("Étui", 7500, ID(4)), 2000, "d"),
  ];
  return { ...emptyBuilder(), clientName: "Mme Durand", height: "220", width: "145", spine: "32", title: "Les Fleurs du Mal", lines };
}

describe("le total en direct du constructeur", () => {
  it("cocher plein cuir + nerfs + dorure titre + étui donne 430 € tout de suite", () => {
    const totals = totalsOf(scenario(), "VAT_LIABLE");
    expect(totals.totalHtCents).toBe(43000);
    expect(totals.totalTtcCents).toBe(51600);
  });

  it("décocher une prestation retire son prix ; modifier un prix ajuste le total sans toucher le catalogue", () => {
    const s = scenario();
    const withoutEtui = { ...s, lines: s.lines.filter((l) => l.label !== "Étui") };
    expect(totalsOf(withoutEtui, "FRANCHISE").totalHtCents).toBe(35500);
    const adjusted = { ...s, lines: s.lines.map((l) => (l.label === "Plein cuir" ? { ...l, unitPriceCents: 34000 } : l)) };
    expect(totalsOf(adjusted, "FRANCHISE").totalHtCents).toBe(49000);
    expect(adjusted.lines[0].catalogPriceCents).toBe(28000);
  });

  it("une ligne libre s'ajoute, une quantité multiplie, la remise et l'acompte suivent", () => {
    const s: BuilderState = {
      ...scenario(),
      lines: [...scenario().lines, { ...freeLine(2000, "e", "Réparation du premier cahier"), unitPriceCents: 5500 }, { ...freeLine(2000, "f", "Frais"), unitPriceCents: 1000, quantity: 2 }],
      discountType: "PERCENT",
      discountValue: "10",
      depositType: "PERCENT",
      depositValue: "30",
    };
    const t = totalsOf(s, "VAT_LIABLE");
    expect(t.subtotalCents).toBe(43000 + 5500 + 2000);
    expect(t.discountCents).toBe(5050);
    expect(t.depositCents).toBe(Math.round((t.totalTtcCents * 3000) / 10000));
    expect(t.balanceCents).toBe(t.totalTtcCents - t.depositCents);
  });

  it("une ligne sans libellé ne compte pas encore ; une saisie de remise invalide vaut zéro à l'écran", () => {
    const s = { ...scenario(), lines: [...scenario().lines, freeLine(2000, "x", "")], discountType: "PERCENT" as const, discountValue: "abc" };
    expect(totalsOf(s, "FRANCHISE").totalHtCents).toBe(43000);
  });
});

describe("la saisie envoyée au serveur", () => {
  it("un devis complet passe la validation, sans aucun total ni numéro", () => {
    const built = toQuoteInput(scenario());
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.input.book).toMatchObject({ heightMm: 220, widthMm: 145, spineMm: 32, title: "Les Fleurs du Mal", author: null });
    expect(built.input.lines).toHaveLength(4);
    expect(JSON.stringify(built.input)).not.toMatch(/total|number|status|binder/i);
  });

  it("il suffit d'un client et d'une ligne : ouvrage, dimensions, titre sont facultatifs", () => {
    const s = { ...emptyBuilder(), clientName: "M. Petit", lines: [{ ...freeLine(2000, "a", "Réparation"), unitPriceCents: 4000 }] };
    expect(toQuoteInput(s).ok).toBe(true);
  });

  it("une prestation sur étude réclame son prix, sans injecter de zéro dans le devis", () => {
    const line = lineFromBasePrice({ pricingKey: "reliure_de_creation", label: "Reliure de création", unit: "ouvrage", unitPriceCents: null, pricingMode: "manual_review" }, 2000, "manual");
    const missing = toQuoteInput({ ...emptyBuilder(), clientName: "Mme Martin", lines: [line] });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.problems).toContain("Définissez le prix pour chaque prestation sur étude.");
    expect(toQuoteInput({ ...emptyBuilder(), clientName: "Mme Martin", lines: [{ ...line, unitPriceCents: 45000 }] }).ok).toBe(true);
  });

  it("dit ce qui manque, dans les mots du relieur", () => {
    const none = toQuoteInput(emptyBuilder());
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.problems).toEqual(expect.arrayContaining(["Nom du client requis.", "Ajoutez au moins une prestation."]));
    const bad = toQuoteInput({ ...scenario(), height: "abc", discountType: "PERCENT", discountValue: "150", lines: [{ ...freeLine(2000, "z", ""), unitPriceCents: 100 }] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.problems).toEqual(expect.arrayContaining(["Hauteur : saisissez un nombre de millimètres.", "Remise : valeur invalide.", "Une ligne n'a pas de libellé."]));
    }
  });

  it("des dimensions vides sont acceptées, une virgule décimale est arrondie au millimètre", () => {
    const built = toQuoteInput({ ...scenario(), height: "", width: "145,4", spine: "" });
    expect(built.ok && built.input.book).toMatchObject({ heightMm: null, widthMm: 145, spineMm: null });
  });
});

describe("modifier un brouillon : le devis revient dans le constructeur à l'identique", () => {
  it("stateFromDocument(devis) → saisie → mêmes lignes, mêmes montants", () => {
    const original = toQuoteInput({ ...scenario(), depositType: "PERCENT", depositValue: "30", discountType: "AMOUNT", discountValue: "20" });
    if (!original.ok) throw new Error("scenario invalide");
    const profile = { ...EMPTY_BILLING_PROFILE, workshopName: "A", vatRegime: "VAT_LIABLE" as const };
    const { quote, items, totals } = buildQuoteRows({ input: original.input, profile, issueDate: "2026-09-19", clientId: null });
    const row = { ...quote, id: "q1", quote_number: "D-2026-0001", status: "draft", created_at: "2026-09-19" } as unknown as QuoteDbRow;
    const view = quoteView(row, items.map((item, i) => ({ ...item, position: i + 1 })), null);

    const back = stateFromDocument(view);
    expect(back.lines.map((l) => [l.label, l.unitPriceCents, l.catalogPriceCents])).toEqual(scenario().lines.map((l) => [l.label, l.unitPriceCents, l.catalogPriceCents]));
    expect([back.height, back.width, back.spine]).toEqual(["220", "145", "32"]);
    expect([back.discountType, back.discountValue, back.depositType, back.depositValue]).toEqual(["AMOUNT", "20", "PERCENT", "30"]);
    expect(totalsOf(back, "VAT_LIABLE").totalTtcCents).toBe(totals.totalTtcCents);
    const again = toQuoteInput(back);
    expect(again.ok).toBe(true);
  });
});
