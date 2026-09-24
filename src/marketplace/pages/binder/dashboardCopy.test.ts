import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildAgenda, type AgendaItem } from "@/marketplace/binders/todayAgenda";
import { FINE_BINDERY_LOCALES, type FineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";
import { agendaTexts, dashboardCopy, longDate, shortDate, translateMissing, type DashboardCopy } from "./dashboardCopy";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const TODAY = "2026-09-24";
const FOREIGN = FINE_BINDERY_LOCALES.filter((locale) => locale !== "fr");

/** Un agenda qui contient les dix sortes d'éléments. */
function everyKind(): AgendaItem[] {
  const base = { caseStatus: "in_progress", unreadCount: 0, title: "Missel", reference: "MR-0001", clientName: "Claire Martin" };
  const doc = { clientName: "Claire Martin", bookTitle: "Atlas", number: "D-2026-0001" };
  return buildAgenda({
    today: TODAY,
    cases: [
      { ...base, caseId: "m", state: "selected", unreadCount: 3 },
      { ...base, caseId: "r", state: "offered", clientName: null },
      { ...base, caseId: "w", state: "selected" },
      { ...base, caseId: "q", state: "selected" },
    ],
    works: [{ id: "work-q", caseId: "q", status: "active" }],
    quotes: [
      { ...doc, id: "exp", status: "sent", validUntil: "2026-09-20" },
      { ...doc, id: "soon", status: "sent", validUntil: "2026-09-28" },
      { ...doc, id: "draft", status: "draft", validUntil: "2026-10-24" },
      { ...doc, id: "acc", status: "accepted", validUntil: "2026-10-24" },
    ],
    invoices: [
      { id: "idraft", number: "Brouillon", status: "draft", clientName: "Jean Dupuis", bookTitle: null, totalTtcCents: 1 },
      { id: "late", number: "F-2026-0006", status: "unpaid", dueDate: "2026-09-18", clientName: "Jean Dupuis", bookTitle: "Littré", totalTtcCents: 1 },
    ],
  });
}

/** Toutes les chaînes qu'une langue peut afficher, fonctions appelées avec des valeurs types. */
function strings(copy: DashboardCopy, items: AgendaItem[], locale: FineBinderyLocale): string[] {
  const out: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string") out.push(value);
    else if (typeof value === "function") for (const arg of [0, 1, 2]) out.push(String((value as (n: number) => unknown)(arg)));
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  const { missingTerms: _terms, kinds: _kinds, ...rest } = copy;
  walk(rest);
  for (const item of items) out.push(...Object.values(agendaTexts(item, locale)));
  return out;
}

describe("le tableau de bord en français (Ma Reliure) ne change pas", () => {
  it("formule chaque élément comme avant la traduction", () => {
    const texts = Object.fromEntries(everyKind().map((item) => [item.kind, agendaTexts(item, "fr")]));
    expect(texts.message).toEqual({ label: "3 messages non lus", title: "Missel", detail: "Claire Martin · MR-0001", action: "Répondre" });
    expect(texts.request).toEqual({ label: "Nouvelle demande", title: "Missel", detail: "MR-0001", action: "Examiner" });
    expect(texts.case_work.detail).toBe("Claire Martin · MR-0001 · fiche ouvrage à créer");
    expect(texts.case_quote).toMatchObject({ label: "Devis à établir", action: "Ouvrir le dossier" });
    expect(texts.quote_expired).toEqual({ label: "Validité dépassée", title: "Atlas", detail: "D-2026-0001 · Claire Martin · expiré le 20 septembre", action: "Voir le devis" });
    expect(texts.quote_expiring.detail).toBe("D-2026-0001 · Claire Martin · valable jusqu'au 28 septembre");
    expect(texts.quote_draft).toMatchObject({ label: "Devis à terminer", detail: "D-2026-0001 · Claire Martin", action: "Continuer" });
    expect(texts.quote_to_invoice).toMatchObject({ label: "Devis accepté", detail: "D-2026-0001 · facture à préparer", action: "Facturer" });
    expect(texts.invoice_draft).toMatchObject({ label: "Facture à émettre", title: "Jean Dupuis", detail: "Brouillon · Jean Dupuis", action: "Émettre" });
    expect(texts.payment_overdue).toEqual({ label: "Paiement en retard", title: "Littré", detail: "F-2026-0006 · échéance du 18 septembre", action: "Voir la facture" });
  });

  it("garde ses accords : zéro au singulier, un seul message sans chiffre", () => {
    const fr = dashboardCopy("fr");
    expect(fr.tiles.requests(0)).toBe("nouvelle demande");
    expect(fr.tiles.requests(2)).toBe("nouvelles demandes");
    expect(fr.now.summary(1, 0)).toBe("1 action — les clients qui attendent une réponse d'abord.");
    expect(fr.setup.accessOn("Ma Reliure")).toBe("Ma Reliure peut vous confier des projets.");
  });
});

describe("le tableau de bord d'un atelier FineBindery", () => {
  it.each(FOREIGN)("%s : aucun texte français oublié", (locale) => {
    const items = everyKind();
    const french = new Set(strings(dashboardCopy("fr"), items, "fr"));
    const leftovers = strings(dashboardCopy(locale), items, locale).filter((text) => french.has(text) && !/^[\d\s—–·,.:;()-]*$/.test(text));
    // Les faits eux-mêmes (titres, noms, références) sont identiques dans toutes les langues : seuls comptent les mots de l'interface.
    const facts = new Set(["Missel", "Atlas", "Littré", "Jean Dupuis", "MR-0001", "Claire Martin · MR-0001", "D-2026-0001 · Claire Martin"]);
    expect(leftovers.filter((text) => !facts.has(text))).toEqual([]);
  });

  it("accorde 0 au pluriel hors du français, et formule les dates dans la langue", () => {
    expect(dashboardCopy("en").tiles.requests(0)).toBe("new requests");
    expect(dashboardCopy("en").tiles.requests(1)).toBe("new request");
    expect(dashboardCopy("de").tiles.messages(0)).toBe("ungelesene Nachrichten");
    expect(shortDate("2026-09-18", "de")).toBe("18. September");
    expect(shortDate("2026-09-18", "it")).toBe("18 settembre");
    expect(shortDate("2026-09-18", "es")).toBe("18 de septiembre");
    const thursday = new Date("2026-09-24T10:00:00Z");
    expect(longDate(thursday, "en")).toMatch(/^Thursday/);
    expect(longDate(thursday, "de")).toMatch(/^Donnerstag/);
    expect(longDate(thursday, "it")).toMatch(/^Giovedì/);
    expect(longDate(thursday, "es")).toMatch(/^Jueves/);
  });

  it("nomme FineBindery, jamais Ma Reliure, dans l'accès aux projets", () => {
    for (const locale of FINE_BINDERY_LOCALES) {
      const setup = dashboardCopy(locale).setup;
      expect(setup.accessOn("FineBindery")).toContain("FineBindery");
      expect(setup.accessOff("FineBindery")).toContain("FineBindery");
    }
  });

  it("traduit chaque champ manquant que le serveur peut renvoyer", () => {
    const sources = [read("src/marketplace/quotes/quoteBuild.ts"), read("src/marketplace/binders/fineBinderyProfile.ts")];
    const missing = sources.flatMap((source) => [...source.matchAll(/missing\.push\("([^"]+)"\)/g)].map((m) => m[1]));
    expect(missing.length).toBeGreaterThanOrEqual(10);
    // Identifiants légaux français : ils se lisent tels quels dans toutes les langues.
    const untranslatable = new Set(["SIREN", "SIRET"]);
    for (const locale of FOREIGN) {
      const copy = dashboardCopy(locale);
      for (const term of missing.filter((t) => !untranslatable.has(t))) expect(copy.missingTerms[term], `${locale}: ${term}`).toBeTruthy();
    }
    expect(translateMissing(["SIREN", "Régime de TVA"], dashboardCopy("en"))).toBe("SIREN, VAT regime");
    expect(translateMissing(["Régime de TVA"], dashboardCopy("fr"))).toBe("Régime de TVA");
  });
});

describe("la page lit ses mots dans le dictionnaire", () => {
  const PAGE = read("src/marketplace/pages/binder/BinderDashboardPage.tsx");

  it("reste en français pour Ma Reliure, suit la langue de l'atelier pour FineBindery", () => {
    expect(PAGE).toContain('isFineBindery ? locale : "fr"');
    expect(PAGE).toContain("useFineBinderyWorkspace()");
  });

  it("n'écrit plus de phrase française en dur", () => {
    for (const phrase of ["Nouveau devis", "À traiter maintenant", "Votre atelier", "Rien ne vous attend", "Réessayer", "donnée indisponible", "Manquant :", "fr-FR"]) {
      expect(PAGE, phrase).not.toContain(phrase);
    }
  });
});
