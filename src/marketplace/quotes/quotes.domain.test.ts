import { describe, expect, it } from "vitest";
import { computeQuote, divRound, lineTotalCents, quantityToHundredths, type CalcLine } from "./quoteCalc";
import {
  effectiveVatRateBps,
  formatDimensions,
  freeLine,
  isPriceAdjusted,
  lineFromService,
  parseMillimetres,
  type CatalogService,
} from "./quoteLines";
import {
  addDays,
  allowedTransitions,
  canConvertToInvoice,
  canTransition,
  effectiveStatus,
  isEditable,
  QUOTE_STATUSES,
} from "./quoteStatus";
import { billingProfileInput, quoteInput } from "./quoteInput";

const line = (unit: number, quantity = 1, vat = 2000): CalcLine => ({ quantity, unitPriceCents: unit, vatRateBps: vat });

describe("le scénario du brief : plein cuir + nerfs + dorure titre + étui", () => {
  const lines = [line(28000), line(3000), line(4500), line(7500)];

  it("le total HT apparaît tout de suite : 430 €", () => {
    const totals = computeQuote({ lines, vatRegime: "VAT_LIABLE" });
    expect(totals.lineTotalsCents).toEqual([28000, 3000, 4500, 7500]);
    expect(totals.subtotalCents).toBe(43000);
    expect(totals.totalHtCents).toBe(43000);
    expect(totals.totalVatCents).toBe(8600);
    expect(totals.totalTtcCents).toBe(51600);
  });

  it("la même chose sans TVA en franchise en base", () => {
    const totals = computeQuote({ lines, vatRegime: "FRANCHISE" });
    expect(totals.totalVatCents).toBe(0);
    expect(totals.totalTtcCents).toBe(43000);
    expect(totals.vatBreakdown).toEqual([{ vatRateBps: 0, baseHtCents: 43000, vatCents: 0 }]);
  });
});

describe("quantité × prix", () => {
  it("multiplie et arrondit au centime, demi vers le haut", () => {
    expect(lineTotalCents(line(4000, 2.5))).toBe(10000);
    expect(lineTotalCents(line(333, 0.5))).toBe(167); // 166,5 → 167
    expect(lineTotalCents(line(1000, 1.25))).toBe(1250);
    expect(lineTotalCents(line(5000, 0))).toBe(0);
  });

  it("n'utilise jamais un flottant pour un montant", () => {
    // 0,07 × 100 € et 1,15 × 1 € sont des cas classiques de dérive en virgule flottante.
    expect(lineTotalCents(line(10000, 0.07))).toBe(700);
    expect(lineTotalCents(line(100, 1.15))).toBe(115);
    expect(quantityToHundredths(1.15)).toBe(115);
  });

  it("refuse une quantité à plus de deux décimales et un prix négatif", () => {
    expect(Number.isNaN(quantityToHundredths(1.234))).toBe(true);
    expect(() => lineTotalCents(line(1000, 1.234))).toThrow();
    expect(() => lineTotalCents(line(-1))).toThrow();
    expect(divRound(5, 2)).toBe(3);
  });
});

describe("TVA", () => {
  it("s'arrondit une fois par taux, pas ligne par ligne", () => {
    // Trois lignes de 3,33 € à 20 % : 3 × 0,67 = 2,01 € ligne par ligne, 2,00 € sur la base 9,99 €.
    const totals = computeQuote({ lines: [line(333), line(333), line(333)], vatRegime: "VAT_LIABLE" });
    expect(totals.subtotalCents).toBe(999);
    expect(totals.totalVatCents).toBe(200);
    expect(totals.totalTtcCents).toBe(1199);
  });

  it("gère plusieurs taux et les ventile", () => {
    const totals = computeQuote({
      lines: [line(10000, 1, 2000), line(10000, 1, 550), line(5000, 1, 2000)],
      vatRegime: "VAT_LIABLE",
    });
    expect(totals.vatBreakdown).toEqual([
      { vatRateBps: 550, baseHtCents: 10000, vatCents: 550 },
      { vatRateBps: 2000, baseHtCents: 15000, vatCents: 3000 },
    ]);
    expect(totals.totalVatCents).toBe(3550);
    expect(totals.totalTtcCents).toBe(28550);
  });

  it("la franchise en base ignore les taux des lignes", () => {
    const totals = computeQuote({ lines: [line(10000, 1, 2000), line(10000, 1, 550)], vatRegime: "FRANCHISE" });
    expect(totals.totalVatCents).toBe(0);
    expect(totals.totalTtcCents).toBe(20000);
    expect(effectiveVatRateBps({ vatRateBps: 2000 }, "FRANCHISE")).toBe(0);
    expect(effectiveVatRateBps({ vatRateBps: 2000 }, "VAT_LIABLE")).toBe(2000);
  });
});

describe("remise", () => {
  it("en pourcentage, sur le sous-total HT", () => {
    const totals = computeQuote({
      lines: [line(43000)],
      vatRegime: "VAT_LIABLE",
      discount: { type: "PERCENT", bps: 1000 },
    });
    expect(totals.discountCents).toBe(4300);
    expect(totals.totalHtCents).toBe(38700);
    expect(totals.totalVatCents).toBe(7740);
    expect(totals.totalTtcCents).toBe(46440);
  });

  it("en euros, plafonnée : un document n'est jamais négatif", () => {
    const totals = computeQuote({ lines: [line(5000)], vatRegime: "VAT_LIABLE", discount: { type: "AMOUNT", cents: 9000 } });
    expect(totals.discountCents).toBe(5000);
    expect(totals.totalHtCents).toBe(0);
    expect(totals.totalTtcCents).toBe(0);
  });

  it("se répartit sur les taux au prorata, la somme est exacte", () => {
    const totals = computeQuote({
      lines: [line(10000, 1, 2000), line(3333, 1, 550)],
      vatRegime: "VAT_LIABLE",
      discount: { type: "AMOUNT", cents: 1001 },
    });
    const bases = totals.vatBreakdown.reduce((a, g) => a + g.baseHtCents, 0);
    expect(totals.discountCents).toBe(1001);
    expect(bases).toBe(totals.totalHtCents);
    expect(totals.totalHtCents).toBe(13333 - 1001);
    expect(totals.totalTtcCents).toBe(totals.totalHtCents + totals.totalVatCents);
  });

  it("refuse une remise hors bornes", () => {
    expect(() => computeQuote({ lines: [line(1000)], vatRegime: "FRANCHISE", discount: { type: "PERCENT", bps: 10001 } })).toThrow();
    expect(() => computeQuote({ lines: [line(1000)], vatRegime: "FRANCHISE", discount: { type: "AMOUNT", cents: -1 } })).toThrow();
  });
});

describe("acompte", () => {
  it("30 % de 500 € TTC : acompte 150 €, solde 350 €", () => {
    const totals = computeQuote({
      lines: [line(50000)],
      vatRegime: "FRANCHISE",
      deposit: { type: "PERCENT", bps: 3000 },
    });
    expect(totals.totalTtcCents).toBe(50000);
    expect(totals.depositCents).toBe(15000);
    expect(totals.balanceCents).toBe(35000);
  });

  it("l'acompte se calcule sur le total TTC, pas sur le HT : 30 % de 516 € = 154,80 €", () => {
    const totals = computeQuote({
      lines: [line(28000), line(3000), line(4500), line(7500)],
      vatRegime: "VAT_LIABLE",
      deposit: { type: "PERCENT", bps: 3000 },
    });
    expect(totals.totalHtCents).toBe(43000);
    expect(totals.totalTtcCents).toBe(51600);
    expect(totals.depositCents).toBe(15480);
    expect(totals.balanceCents).toBe(36120);
  });

  it("un acompte fixe est plafonné au total ; sans acompte, le solde est le total", () => {
    expect(computeQuote({ lines: [line(1000)], vatRegime: "FRANCHISE", deposit: { type: "AMOUNT", cents: 5000 } }).depositCents).toBe(1000);
    const none = computeQuote({ lines: [line(1000)], vatRegime: "FRANCHISE" });
    expect(none.depositCents).toBe(0);
    expect(none.balanceCents).toBe(1000);
  });
});

describe("lignes : catalogue, prix modifié pour ce devis, ligne libre", () => {
  const catalog: CatalogService = Object.freeze({
    id: "8d7a8c8e-6c53-4a1c-9a36-0d1f3c0d8a10",
    categoryId: null,
    name: "Plein cuir",
    description: null,
    unitPriceCents: 28000,
    vatRateBps: null,
    unit: null,
  });

  it("sélectionner une prestation ajoute son prix, et le taux par défaut si elle n'en a pas", () => {
    const l = lineFromService(catalog, 2000, "k1");
    expect(l).toMatchObject({ label: "Plein cuir", unitPriceCents: 28000, catalogPriceCents: 28000, vatRateBps: 2000, quantity: 1 });
    expect(isPriceAdjusted(l)).toBe(false);
  });

  it("modifier le prix d'une ligne ne modifie pas le catalogue (280 € → 340 € sur cet ouvrage)", () => {
    const original = lineFromService(catalog, 2000, "k1");
    const adjusted = { ...original, unitPriceCents: 34000 };
    expect(isPriceAdjusted(adjusted)).toBe(true);
    expect(adjusted.catalogPriceCents).toBe(28000);
    expect(catalog.unitPriceCents).toBe(28000); // gelé : toute écriture aurait échoué
    expect(computeQuote({ lines: [adjusted], vatRegime: "FRANCHISE" }).totalHtCents).toBe(34000);
  });

  it("un changement ultérieur du catalogue ne change pas une ligne déjà créée", () => {
    const l = lineFromService(catalog, 2000, "k1");
    const later: CatalogService = { ...catalog, unitPriceCents: 99900, name: "Plein cuir (nouveau nom)" };
    expect(lineFromService(later, 2000, "k2").unitPriceCents).toBe(99900);
    expect(l.unitPriceCents).toBe(28000);
    expect(l.label).toBe("Plein cuir");
  });

  it("une ligne libre n'a pas de prix de catalogue et n'est jamais « ajustée »", () => {
    const l = { ...freeLine(2000, "k3", "Réparation particulière du premier cahier"), unitPriceCents: 5500 };
    expect(l.serviceId).toBeNull();
    expect(l.catalogPriceCents).toBeNull();
    expect(isPriceAdjusted(l)).toBe(false);
    expect(computeQuote({ lines: [l], vatRegime: "FRANCHISE" }).totalHtCents).toBe(5500);
  });
});

describe("dimensions", () => {
  it("s'affichent en compact : 220 × 145 × 32 mm", () => {
    expect(formatDimensions({ heightMm: 220, widthMm: 145, spineMm: 32 })).toBe("220 × 145 × 32 mm");
  });
  it("les dimensions manquantes deviennent « – », et aucune dimension ne donne rien", () => {
    expect(formatDimensions({ heightMm: 220, widthMm: 145, spineMm: null })).toBe("220 × 145 × – mm");
    expect(formatDimensions({ heightMm: null, widthMm: null, spineMm: null })).toBeNull();
  });
  it("une saisie en millimètres accepte la virgule et refuse le vide ou l'absurde", () => {
    expect(parseMillimetres("220")).toBe(220);
    expect(parseMillimetres(" 22,5 ")).toBe(23);
    expect(parseMillimetres("")).toBeNull();
    expect(parseMillimetres("abc")).toBeNull();
    expect(parseMillimetres("-3")).toBeNull();
    expect(parseMillimetres("5000")).toBeNull();
  });
});

describe("statuts", () => {
  it("les six statuts du brief existent", () => {
    expect([...QUOTE_STATUSES]).toEqual(["draft", "sent", "accepted", "refused", "expired", "invoiced"]);
  });
  it("on ne devient « facturé » qu'en convertissant, et seul un devis accepté se convertit", () => {
    for (const from of QUOTE_STATUSES) expect(canTransition(from, "invoiced")).toBe(false);
    expect(QUOTE_STATUSES.filter(canConvertToInvoice)).toEqual(["accepted"]);
    expect(allowedTransitions("invoiced")).toEqual([]);
  });
  it("seul un brouillon se modifie", () => {
    expect(QUOTE_STATUSES.filter(isEditable)).toEqual(["draft"]);
  });
  it("un devis dont la validité est dépassée se lit « expiré », sans rien écrire", () => {
    expect(effectiveStatus("sent", "2026-09-01", "2026-09-19")).toBe("expired");
    expect(effectiveStatus("draft", "2026-09-01", "2026-09-19")).toBe("expired");
    expect(effectiveStatus("sent", "2026-09-19", "2026-09-19")).toBe("sent");
    expect(effectiveStatus("accepted", "2026-01-01", "2026-09-19")).toBe("accepted");
  });
  it("calcule la fin de validité sans décalage d'heure", () => {
    expect(addDays("2026-09-19", 30)).toBe("2026-10-19");
    expect(addDays("2026-12-20", 30)).toBe("2027-01-19");
    expect(addDays("2026-03-15", 30)).toBe("2026-04-14");
  });
});

describe("ce que le navigateur peut envoyer", () => {
  const valid = {
    clientId: null,
    client: { name: "Mme Durand" },
    book: { title: "Les Fleurs du Mal", heightMm: 220, widthMm: 145, spineMm: 32 },
    lines: [
      {
        serviceId: null,
        label: "Plein cuir",
        quantity: 1,
        unitPriceCents: 28000,
        catalogPriceCents: 28000,
        vatRateBps: 2000,
      },
    ],
    discount: { type: "NONE" },
    deposit: { type: "PERCENT", bps: 3000 },
    validityDays: null,
  };

  it("accepte un devis minimal : un client, une ligne — titre, auteur, notes facultatifs", () => {
    expect(quoteInput.safeParse(valid).success).toBe(true);
  });

  it("refuse tout champ calculé ou serveur : total, numéro, statut, émetteur", () => {
    for (const extra of ["totalCents", "totalTtcCents", "quoteNumber", "status", "issuer", "binderId"]) {
      expect(quoteInput.safeParse({ ...valid, [extra]: 1 }).success, extra).toBe(false);
    }
    const line = { ...valid.lines[0], totalHtCents: 1 };
    expect(quoteInput.safeParse({ ...valid, lines: [line] }).success).toBe(false);
  });

  it("exige un nom de client et au moins une ligne", () => {
    expect(quoteInput.safeParse({ ...valid, client: { name: " " } }).success).toBe(false);
    expect(quoteInput.safeParse({ ...valid, lines: [] }).success).toBe(false);
  });

  it("borne les dimensions, la quantité et les prix", () => {
    expect(quoteInput.safeParse({ ...valid, book: { ...valid.book, heightMm: 0 } }).success).toBe(false);
    expect(quoteInput.safeParse({ ...valid, book: { ...valid.book, heightMm: 5000 } }).success).toBe(false);
    expect(quoteInput.safeParse({ ...valid, lines: [{ ...valid.lines[0], quantity: 1.234 }] }).success).toBe(false);
    expect(quoteInput.safeParse({ ...valid, lines: [{ ...valid.lines[0], unitPriceCents: -5 }] }).success).toBe(false);
    expect(quoteInput.safeParse({ ...valid, lines: [{ ...valid.lines[0], unitPriceCents: 10.5 }] }).success).toBe(false);
  });

  it("le profil : préfixes sûrs, aucun régime fiscal imposé", () => {
    const profile = {
      vatRegime: null,
      defaultVatRateBps: 2000,
      quotePrefix: "D",
      invoicePrefix: "F",
      quoteValidityDays: 30,
    };
    expect(billingProfileInput.safeParse(profile).success).toBe(true);
    expect(billingProfileInput.safeParse({ ...profile, quotePrefix: "D 1/" }).success).toBe(false);
    expect(billingProfileInput.safeParse({ ...profile, vatRegime: "AUTRE" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Saisie des montants
// ---------------------------------------------------------------------------
import { bpsToPercentInput, centsToEuroInput, parseEurosToCents, parsePercentToBps, parseQuantity, parseServerError } from "./quoteFormat";

describe("saisie des montants : du texte du relieur aux centimes", () => {
  it("lit « 280 », « 280,5 », « 280.50 », « 1 250,00 » et « 1.250,00 € »", () => {
    expect(parseEurosToCents("280")).toBe(28000);
    expect(parseEurosToCents("280,5")).toBe(28050);
    expect(parseEurosToCents("280.50")).toBe(28050);
    expect(parseEurosToCents("1 250,00")).toBe(125000);
    expect(parseEurosToCents("1\u202F250,00 €")).toBe(125000);
    expect(parseEurosToCents("1.250,00")).toBe(125000);
    expect(parseEurosToCents("0,05")).toBe(5);
    expect(parseEurosToCents(",5")).toBe(50);
  });
  it("arrondit au centime au-delà de deux décimales, sans dérive de flottant", () => {
    expect(parseEurosToCents("0,285")).toBe(29);
    expect(parseEurosToCents("19,99")).toBe(1999);
    expect(parseEurosToCents("1,15")).toBe(115);
  });
  it("refuse le vide, le texte, le négatif et l'absurde", () => {
    for (const bad of ["", "  ", "abc", "-5", "12e3", "1,2,x", "999999999"]) expect(parseEurosToCents(bad), bad).toBeNull();
  });
  it("réécrit des centimes dans un champ, sans décimales inutiles", () => {
    expect(centsToEuroInput(28000)).toBe("280");
    expect(centsToEuroInput(28050)).toBe("280,50");
    expect(centsToEuroInput(5)).toBe("0,05");
    expect(parseEurosToCents(centsToEuroInput(123456))).toBe(123456);
  });
  it("quantités et pourcentages", () => {
    expect(parseQuantity("1,5")).toBe(1.5);
    expect(parseQuantity("2")).toBe(2);
    expect(parseQuantity("0")).toBeNull();
    expect(parseQuantity("1,234")).toBeNull();
    expect(parsePercentToBps("30")).toBe(3000);
    expect(parsePercentToBps("5,5")).toBe(550);
    expect(parsePercentToBps("101")).toBeNull();
    expect(bpsToPercentInput(550)).toBe("5,5");
  });
  it("lit ce que le serveur dit d'un profil incomplet, et jamais autre chose comme un message technique", () => {
    expect(parseServerError(new Error("profile_incomplete:Nom de l'atelier|Régime de TVA"))).toEqual({
      code: "profile_incomplete",
      missing: ["Nom de l'atelier", "Régime de TVA"],
    });
    expect(parseServerError(new Error("Introuvable."))).toEqual({ code: "other", missing: [] });
  });
});
