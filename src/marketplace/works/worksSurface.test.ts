// Ce que la surface « Contacts + Ouvrages » ne doit jamais perdre, vérifié sur le texte des sources :
// chaque server function passe par l'authentification, aucune n'accepte d'identifiant d'atelier,
// et l'espace atelier garde sa navigation ET son bouton de déconnexion (PR #8).
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");

describe("server functions des contacts et ouvrages", () => {
  const SRC = read("src/marketplace/services/binderWorks.data.functions.ts");
  const fns = [...SRC.matchAll(/export const (\w+) = createServerFn\(\{ method: "(GET|POST)" \}\)([\s\S]*?)(?=\nexport const |\n*$)/g)];

  it("expose exactement huit fonctions", () => {
    expect(fns.map((m) => m[1]).sort()).toEqual([
      "getMyContact", "getMyContacts", "getMyWork", "getMyWorks", "saveMyContact", "saveMyWork", "setMyContactArchived", "setMyWorkArchived",
    ]);
  });

  it.each(fns.map((m) => [m[1], m[2], m[3]] as const))("%s : authentifiée, entrée validée, atelier résolu depuis la session", (_name, method, body) => {
    expect(body).toContain(".middleware([requireSupabaseAuth])");
    expect(body).toContain(".inputValidator(");
    expect(body).toContain("run(context.userId");
    // Jamais l'atelier depuis l'entrée du navigateur.
    expect(body).not.toMatch(/data\.binderId|data\.binder_id/);
    // Les lectures sont des GET, les écritures des POST.
    expect(method).toBe(/^(get)/.test(_name) ? "GET" : "POST");
  });

  it("aucun schéma d'entrée ne porte l'atelier, la référence, la source, l'origine ni le dossier", () => {
    const INPUT = read("src/marketplace/works/workInput.ts");
    expect(INPUT).not.toMatch(/\b(binderId|binder_id|reference|source|origin|caseId|case_id|status)\s*:/);
    expect(INPUT.match(/\.strict\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe("l'espace atelier", () => {
  const LAYOUT = read("src/routes/_authenticated/atelier/route.tsx");

  it("garde ses surfaces historiques dans la nouvelle navigation métier", () => {
    for (const to of ['to="/atelier"', 'to="/atelier/ouvrages"', 'to="/atelier/devis"', 'to="/atelier/contacts"', 'to="/atelier/tarifs"']) {
      expect(LAYOUT, to).toContain(to);
    }
    expect(LAYOUT.indexOf("Devis")).toBeLessThan(LAYOUT.indexOf("Ouvrages"));
    expect(LAYOUT).toContain("Messages");
    expect(LAYOUT).toContain("Factures");
  });

  it("garde le bouton de déconnexion de la PR #8, et des cibles tactiles de 44 px", () => {
    expect(LAYOUT).toContain("<SignOutButton");
    expect(LAYOUT).toContain("min-h-11");
  });

  it("chaque écran a sa route", () => {
    for (const file of ["contacts.index", "contacts.$contactId", "ouvrages.index", "ouvrages.nouveau", "ouvrages.$workId.index", "ouvrages.$workId.modifier"]) {
      expect(existsSync(resolve(process.cwd(), `src/routes/_authenticated/atelier/${file}.tsx`)), file).toBe(true);
    }
  });

  it("le devis accepte `?workId=` mais seulement comme une aide à la saisie", () => {
    const ROUTE = read("src/routes/_authenticated/atelier/devis.nouveau.tsx");
    expect(ROUTE).toContain("workId");
    expect(ROUTE).toMatch(/Jamais une autorisation/);
  });
});

describe("vocabulaire", () => {
  it("aucun mot interdit dans les sources nouvelles (Formulaire, Questionnaire, Lead, Prompt, Utilisateur)", () => {
    const files = [
      "src/marketplace/works/workInput.ts", "src/marketplace/works/workViews.ts", "src/marketplace/works/contactName.ts",
      "src/marketplace/works/workSearch.ts", "src/marketplace/services/binderWorks.server.ts",
      "src/marketplace/services/binderWorks.data.functions.ts",
      "src/marketplace/pages/binder/works/ContactsPage.tsx", "src/marketplace/pages/binder/works/ContactPage.tsx",
      "src/marketplace/pages/binder/works/WorkPage.tsx", "src/marketplace/pages/binder/works/WorksPage.tsx",
      "src/marketplace/pages/binder/works/WorkFormPage.tsx", "src/marketplace/pages/binder/works/ContactForm.tsx",
    ];
    for (const file of files) {
      expect(read(file), file).not.toMatch(/\b(formulaire|questionnaire|lead|prompt|utilisateur)s?\b/i);
    }
  });
});
