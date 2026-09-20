import { describe, expect, it } from "vitest";
import { emptyBuilder, stateFromDocument, stateFromWork, toQuoteInput } from "@/marketplace/quotes/builderState";
import type { DocumentView } from "@/marketplace/quotes/quoteViews";
import { contactDisplayName } from "./contactName";
import { contactInput, workInput } from "./workInput";
import { matchesSearch, normalizeSearch } from "./workSearch";
import { formatWeight, formatWorkDimensions, workOneLiner, type ContactView, type WorkSummary, type WorkView } from "./workViews";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("le nom d'un contact est déduit, jamais saisi en double", () => {
  it.each([
    [{ firstName: "Claire", lastName: "Martin", organization: null }, "Claire Martin"],
    [{ firstName: null, lastName: "Martin", organization: null }, "Martin"],
    [{ firstName: "Claire", lastName: null, organization: null }, "Claire"],
    [{ firstName: null, lastName: null, organization: "Bibliothèque municipale" }, "Bibliothèque municipale"],
    [{ firstName: "Claire", lastName: "Martin", organization: "Bibliothèque municipale" }, "Claire Martin — Bibliothèque municipale"],
    [{ firstName: "  Claire ", lastName: " Martin  ", organization: "  " }, "Claire Martin"],
    [{ firstName: null, lastName: null, organization: null }, ""],
  ])("%j → %j", (parts, expected) => {
    expect(contactDisplayName(parts)).toBe(expected);
  });
});

describe("contactInput", () => {
  const base = { id: null, firstName: null, lastName: "Martin", organization: null, email: null, phone: null, addressLine1: null, postalCode: null, city: null, country: null, notes: null };
  it("accepte un nom seul ; refuse un contact sans nom, prénom ni entreprise", () => {
    expect(contactInput.safeParse(base).success).toBe(true);
    expect(contactInput.safeParse({ ...base, lastName: "  " }).success).toBe(false);
    expect(contactInput.safeParse({ ...base, lastName: null, organization: "Institut" }).success).toBe(true);
  });
  it("normalise les champs vides en null et coupe les espaces", () => {
    const parsed = contactInput.parse({ ...base, lastName: "  Martin ", phone: "  ", email: "" });
    expect(parsed.lastName).toBe("Martin");
    expect(parsed.phone).toBeNull();
    expect(parsed.email).toBeNull();
  });
  it("refuse une adresse e-mail invalide, accepte une plausible", () => {
    expect(contactInput.safeParse({ ...base, email: "pas une adresse" }).success).toBe(false);
    expect(contactInput.safeParse({ ...base, email: "claire@example.test" }).success).toBe(true);
  });
  it("refuse tout champ inconnu — jamais l'atelier, l'origine ni l'archivage (.strict())", () => {
    for (const extra of [{ binderId: uuid(1) }, { origin: "ma_reliure" }, { archivedAt: "2026-01-01" }, { originCaseId: uuid(2) }, { name: "Nom forcé" }]) {
      expect(contactInput.safeParse({ ...base, ...extra }).success, JSON.stringify(extra)).toBe(false);
    }
  });
});

describe("workInput", () => {
  const base = { id: null, contactId: uuid(1), title: "Les Misérables", author: null, editionNote: null, description: null, heightMm: 220, widthMm: 145, thicknessMm: 32, weightGrams: null, declaredValueCents: null, conditionNotes: null, internalNotes: null };
  it("accepte le cas canonique 220 × 145 × 32 mm", () => {
    expect(workInput.safeParse(base).success).toBe(true);
  });
  it("un titre et un contact suffisent ; le reste est facultatif", () => {
    expect(workInput.safeParse({ ...base, heightMm: null, widthMm: null, thicknessMm: null }).success).toBe(true);
    expect(workInput.safeParse({ ...base, title: "   " }).success).toBe(false);
    expect(workInput.safeParse({ ...base, contactId: "pas-un-uuid" }).success).toBe(false);
  });
  it.each([
    ["hauteur 0", { heightMm: 0 }], ["largeur négative", { widthMm: -1 }], ["épaisseur 2001", { thicknessMm: 2001 }],
    ["dimension décimale", { heightMm: 220.5 }], ["poids 0", { weightGrams: 0 }], ["poids 50 001", { weightGrams: 50_001 }],
    ["valeur négative", { declaredValueCents: -1 }], ["valeur décimale", { declaredValueCents: 12.5 }],
  ])("refuse %s", (_name, patch) => {
    expect(workInput.safeParse({ ...base, ...patch }).success).toBe(false);
  });
  it("refuse tout champ inconnu — jamais la référence, la source, le dossier, le statut ni l'atelier (.strict())", () => {
    for (const extra of [{ binderId: uuid(9) }, { reference: "O-2026-9999" }, { source: "ma_reliure" }, { caseId: uuid(3) }, { status: "archived" }]) {
      expect(workInput.safeParse({ ...base, ...extra }).success, JSON.stringify(extra)).toBe(false);
    }
  });
});

describe("une ligne pour reconnaître un ouvrage en cinq secondes", () => {
  const summary: WorkSummary = { id: uuid(1), reference: "O-2026-0001", title: "Les Misérables", author: "Victor Hugo", contactId: uuid(2), contactName: "Mme Martin", heightMm: 220, widthMm: 145, thicknessMm: 32, conditionNotes: "Dos détaché · coins usés", status: "active", source: "mon_client", quoteCount: 0, createdAt: "2026-09-21" };
  it("titre — auteur · contact · dimensions · état", () => {
    expect(workOneLiner(summary)).toBe("Les Misérables — Victor Hugo · Mme Martin · 220 × 145 × 32 mm · Dos détaché · coins usés");
  });
  it("ce qui manque disparaît, sans trou ni séparateur orphelin", () => {
    expect(workOneLiner({ ...summary, author: null, contactName: null, heightMm: null, widthMm: null, thicknessMm: null, conditionNotes: null })).toBe("Les Misérables");
  });
  it("les dimensions partielles se lisent, les manquantes deviennent « – »", () => {
    expect(formatWorkDimensions({ heightMm: 220, widthMm: null, thicknessMm: 32 })).toBe("220 × – × 32 mm");
    expect(formatWorkDimensions({ heightMm: null, widthMm: null, thicknessMm: null })).toBeNull();
  });
  it("le poids : grammes sous le kilo, kilos au-dessus", () => {
    expect(formatWeight(900)).toBe("900 g");
    expect(formatWeight(1200)).toMatch(/^1,2 kg$/);
    expect(formatWeight(null)).toBeNull();
  });
});

describe("la recherche des listes est tolérante", () => {
  it("accents, casse, apostrophes, ponctuation", () => {
    expect(normalizeSearch("  L’Assommoir — Zola ! ")).toBe("l'assommoir zola");
    expect(matchesSearch("Les Misérables — Victor Hugo · Mme Martin", "miserables")).toBe(true);
    expect(matchesSearch("L’Assommoir", "l'assommoir")).toBe(true);
    expect(matchesSearch("Les Misérables", "MARTIN hugo")).toBe(false);
  });
  it("les mots se cherchent dans n'importe quel ordre ; une recherche vide garde tout", () => {
    expect(matchesSearch("Les Misérables Victor Hugo Mme Martin", "hugo martin")).toBe(true);
    expect(matchesSearch("Les Misérables", "   ")).toBe(true);
  });
});

describe("un devis qui part d'un ouvrage ne ressaisit rien", () => {
  const contact: ContactView = { id: uuid(2), name: "Claire Martin", firstName: "Claire", lastName: "Martin", organization: null, email: "claire@example.test", phone: "06 00", addressLine1: "1 rue X", postalCode: "75001", city: "Paris", country: null, notes: null, origin: "mon_client", archived: false };
  const work: WorkView = { id: uuid(1), reference: "O-2026-0001", contactId: uuid(2), title: "Les Misérables", author: "Victor Hugo", editionNote: null, description: null, heightMm: 220, widthMm: 145, thicknessMm: 32, weightGrams: 900, declaredValueCents: null, conditionNotes: "Dos détaché", internalNotes: "ne pas imprimer", status: "active", source: "mon_client", createdAt: "x", updatedAt: "x" };

  it("le contact et le livre sont remplis, l'épaisseur de l'ouvrage devient le dos du devis", () => {
    const state = stateFromWork(work, contact);
    expect(state).toMatchObject({ workId: work.id, clientId: contact.id, clientName: "Claire Martin", clientEmail: "claire@example.test", title: "Les Misérables", author: "Victor Hugo", height: "220", width: "145", spine: "32", bookNotes: "Dos détaché" });
    expect(state.lines).toEqual([]);
  });
  it("les notes internes de l'ouvrage ne passent jamais dans le devis", () => {
    expect(JSON.stringify(stateFromWork(work, contact))).not.toContain("ne pas imprimer");
  });
  it("sans contact, le devis part quand même", () => {
    expect(stateFromWork(work, null)).toMatchObject({ workId: work.id, clientId: null, clientName: "" });
  });
  it("le devis envoie l'ouvrage seulement s'il y en a un — un devis sans ouvrage est inchangé", () => {
    const line = { key: "k", serviceId: null, label: "Plein cuir", description: "", unit: null, quantity: 1, unitPriceCents: 28000, catalogPriceCents: null, vatRateBps: 2000 };
    const withWork = toQuoteInput({ ...stateFromWork(work, contact), lines: [line] });
    expect(withWork.ok && withWork.input.workId).toBe(work.id);
    const without = toQuoteInput({ ...emptyBuilder(), clientName: "X", lines: [line] });
    expect(without.ok && "workId" in without.input).toBe(false);
  });
  it("rouvrir un devis brouillon rattaché conserve son ouvrage", () => {
    const doc = { workId: work.id, client: { id: null, name: "x", email: null, phone: null, addressLine1: null, postalCode: null, city: null, country: null }, book: { title: null, author: null, heightMm: null, widthMm: null, spineMm: null, notes: null }, items: [], discountType: "NONE", discountValue: 0, depositType: "NONE", depositValue: 0, notes: null } as unknown as DocumentView;
    expect(stateFromDocument(doc).workId).toBe(work.id);
    expect(stateFromDocument({ ...doc, workId: undefined }).workId).toBeNull();
  });
});
