/**
 * Les vraies pages client, rendues en HTML avec des données de test — pas une
 * copie de leur logique. Les modules serveur, le routeur et le transport sont
 * remplacés par des doubles minimaux : seul le rendu est sous test (voir
 * vitest.config.ts : environnement node, pas de DOM ; les interactions — clic,
 * saisie, redirection Stripe — ne sont pas couvertes ici).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  conversationFixture,
  decisionsFixture,
  detailFixture,
  listFixture,
  type Brand,
} from "@/marketplace/customer/customerTestFixtures";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, params, children, activeProps: _activeProps, ...rest }: { to: string; params?: Record<string, string>; children?: ReactNode; activeProps?: unknown }) =>
    createElement(
      "a",
      { href: params ? to.replace(/\$(\w+)/g, (_m, key: string) => params[key] ?? "") : to, ...rest },
      children,
    ),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/marketplace/services/marketplace.data.functions", () => ({
  getMyCustomerCase: vi.fn(),
  listMyCustomerCases: vi.fn(),
  claimMarketplaceCase: vi.fn(),
}));
vi.mock("@/marketplace/services/messaging.data.functions", () => ({
  listCaseMessages: vi.fn(),
  markConversationRead: vi.fn(),
  sendCaseMessage: vi.fn(),
}));
vi.mock("@/marketplace/services/decisions.data.functions", () => ({
  listCaseDecisions: vi.fn(),
  answerCaseDecision: vi.fn(),
  cancelCaseDecision: vi.fn(),
  requestCaseDecision: vi.fn(),
}));
vi.mock("@/marketplace/stripe/checkoutSession.server", () => ({ createCommercialCheckoutSession: vi.fn() }));

const { CustomerCaseListPage } = await import("./CustomerCaseListPage");
const { CustomerCasePage } = await import("./CustomerCasePage");
const { CustomerPortalShell } = await import("./CustomerPortalShell");
const { PortalError, PortalEmpty, PortalListSkeleton, PortalDetailSkeleton } = await import("./CustomerPortalUi");
const { CustomerPhotoGallery } = await import("./CustomerPhotoGallery");
const { customerCopy, sortForCustomer } = await import("@/marketplace/customer/customerPresentation");

const CASE_ID = "11111111-1111-4111-8111-111111111111";

function client(brand: Brand, scenario: string, only: "list" | "detail") {
  const c = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  if (only === "list") c.setQueryData(["marketplace", "customer", "cases"], listFixture(brand, scenario));
  else {
    c.setQueryData(["marketplace", "customer", "case", CASE_ID], detailFixture(brand, scenario));
    c.setQueryData(["marketplace", "conversation", CASE_ID], conversationFixture(brand, scenario));
    c.setQueryData(["marketplace", "decisions", CASE_ID], decisionsFixture(brand, scenario));
  }
  return c;
}

const detail = (brand: Brand, scenario: string) =>
  renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: client(brand, scenario, "detail") },
      createElement(CustomerCasePage, { caseId: CASE_ID, brand }),
    ),
  );

const list = (brand: Brand, scenario: string) =>
  renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: client(brand, scenario, "list") },
      createElement(CustomerCaseListPage, { brand }),
    ),
  );

const count = (html: string, needle: string) => html.split(needle).length - 1;
/** Le code sans ses commentaires : un commentaire peut citer ce que le code s'interdit. */
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const SCENARIOS = ["A", "C", "D", "E", "F", "G", "H"];
const BRANDS: Brand[] = ["MA_RELIURE", "FINE_BINDERY"];

/** Ce qu'un client ne doit lire dans aucun scénario, aucune marque. */
const RAW_LEAKS = [
  "manual_review_required",
  "FIXED_PRICE",
  "ESTIMATE_THEN_CONFIRM",
  "MANUAL_STUDY",
  "checkout_eligible",
  "pricing_ready",
  ">undefined<",
  ">null<",
  ">true<",
  ">false<",
  "payout",
  "margin",
  "contribution",
  "[object Object]",
  "&quot;choice&quot;",
  "&quot;text&quot;",
];

describe("retour vers la liste", () => {
  it("chaque page détail a un bouton de retour déterministe vers /mes-livres", () => {
    for (const brand of BRANDS) {
      for (const scenario of SCENARIOS) {
        const html = detail(brand, scenario);
        expect(html, `${brand}/${scenario}`).toContain('href="/mes-livres"');
        expect(html).toContain(brand === "MA_RELIURE" ? "Mes livres" : "My books");
      }
    }
  });

  it("ne dépend jamais de l'historique du navigateur", () => {
    for (const file of ["CustomerCasePage.tsx", "CustomerCaseListPage.tsx", "CustomerPortalShell.tsx"]) {
      const source = readFileSync(resolve(process.cwd(), "src/marketplace/pages/customer", file), "utf8");
      expect(source, file).not.toMatch(/history\.back|history\.go|navigate\(-1\)|router\.history/);
    }
    const detailSource = readFileSync(resolve(process.cwd(), "src/marketplace/pages/customer/CustomerCasePage.tsx"), "utf8");
    expect(detailSource).toContain('to="/mes-livres"');
  });

  it("le cadre offre toujours « Mes livres », l'accueil et un lien d'évitement", () => {
    for (const [brand, books] of [["MA_RELIURE", "Mes livres"], ["FINE_BINDERY", "My books"]] as const) {
      const html = renderToStaticMarkup(createElement(CustomerPortalShell, { brand, children: createElement("p", null, "x") }));
      expect(html).toContain('href="/"');
      expect(html).toContain('href="/mes-livres"');
      expect(html).toContain(books);
      expect(html).toContain('href="#main"');
      expect(html).toContain('id="main"');
    }
  });
});

describe("détail : ce que le client lit", () => {
  it("annonce le statut et la prochaine étape sur chaque scénario", () => {
    for (const brand of BRANDS) {
      for (const scenario of SCENARIOS) {
        const html = detail(brand, scenario);
        expect(html).toContain(brand === "MA_RELIURE" ? "Prochaine étape" : "Next step");
        expect(html).toContain('aria-labelledby="next-step-title"');
      }
    }
  });

  it("ne montre jamais un enum brut, un true/false, un null ni une donnée interne", () => {
    for (const brand of BRANDS) {
      for (const scenario of SCENARIOS) {
        const html = detail(brand, scenario);
        for (const leak of RAW_LEAKS) expect(html, `${brand}/${scenario} : ${leak}`).not.toContain(leak);
        // Les valeurs d'état techniques ne sont jamais rendues comme texte.
        expect(html).not.toMatch(/>(under_review|pricing|matching|awaiting_binder_response|binder_selected|awaiting_payment|in_progress|completed)</);
      }
    }
  });

  it("A — projet sans proposition : pas de carte de prix, une phrase claire", () => {
    const html = detail("MA_RELIURE", "A");
    expect(html).toContain("Nous étudions votre projet.");
    expect(html).toContain("Aucune action requise de votre part.");
    expect(html).not.toContain("Votre proposition");
    expect(html).not.toContain(">Payer<");
  });

  it("C — proposition disponible : un prix, sans bouton, avec le message d'attente du paiement", () => {
    const html = detail("MA_RELIURE", "C");
    expect(html).toContain("Votre proposition");
    expect(html).toContain("Prix de votre projet");
    expect(html).toContain("Voir ma proposition");
    expect(html).toContain('href="#proposal"');
    expect(html).toContain("Le paiement sera disponible après validation de votre proposition.");
    expect(html).not.toContain(">Payer<");
  });

  it("D — proposition confirmée mais paiement impossible : HT seulement, jamais un bouton désactivé", () => {
    const html = detail("MA_RELIURE", "D");
    expect(html).toContain("Total HT");
    expect(html).not.toContain("Total TTC");
    expect(html).not.toContain("TVA");
    expect(html).toContain("Le paiement sera disponible après validation de votre proposition.");
    expect(html).not.toContain(">Payer<");
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>\s*Payer/);
  });

  it("E — paiement possible : un seul bouton Payer, en haut, avant la proposition", () => {
    const html = detail("MA_RELIURE", "E");
    expect(count(html, ">Payer<")).toBe(1);
    expect(html.indexOf('id="next-step-title"')).toBeLessThan(html.indexOf(">Payer<"));
    expect(html.indexOf(">Payer<")).toBeLessThan(html.indexOf('id="proposal-title"'));
    expect(html).toContain("Total HT");
    expect(html).toContain("TVA (20 %)");
    expect(html).toContain("Total TTC");
    expect(html).toContain("Prix ferme");
    expect(html).not.toContain("Le paiement sera disponible");
  });

  it("E — Fine Bindery : Pay securely, en anglais seulement", () => {
    const html = detail("FINE_BINDERY", "E");
    expect(count(html, ">Pay securely<")).toBe(1);
    expect(html).toContain("Total excl. tax");
    expect(html).toContain("VAT (20%)");
    expect(html).toContain("Total incl. tax");
    expect(html).toContain("Fixed price");
    expect(html).not.toContain(">Payer<");
  });

  it("F — payé : plus de bouton, un accusé de réception", () => {
    for (const brand of BRANDS) {
      const html = detail(brand, "F");
      expect(html).not.toContain(">Payer<");
      expect(html).not.toContain(">Pay securely<");
      expect(html).toContain(brand === "MA_RELIURE" ? "Paiement reçu. Merci." : "Payment received. Thank you.");
      expect(html).toContain(brand === "MA_RELIURE" ? "Paiement confirmé" : "Payment confirmed");
    }
  });

  it("G — décision en attente : action mise en avant, réponses relues en mots, jamais en JSON", () => {
    const html = detail("MA_RELIURE", "G");
    expect(html).toContain("En attente de votre confirmation");
    expect(html).toContain('id="decisions"');
    expect(html).toContain('href="#decisions"');
    expect(html.indexOf('id="decisions"')).toBeLessThan(html.indexOf('id="proposal-title"'));
    expect(html).toContain("LE COMTE DE MONTE-CRISTO");
    expect(html).toContain("Toile écrue");
    expect(html).not.toContain("&quot;");
    expect(html).toContain("Confirmer mon choix");
    // Le champ est nommé par sa question, pour un lecteur d'écran.
    expect(html).toContain('for="decision-d1"');
  });

  it("H — terminé : l'atelier est présenté sans aucun moyen de le contacter directement", () => {
    for (const brand of BRANDS) {
      const html = detail(brand, "H");
      expect(html).toContain("Atelier Reliure Dorure Ferrière");
      expect(html).not.toMatch(/mailto:|tel:/);
      expect(html).not.toMatch(/Contacter l|Contact the workshop|Appeler|Call the workshop/);
    }
  });

  it("montre l'historique sans logs internes", () => {
    const html = detail("MA_RELIURE", "H");
    expect(html).toContain("Historique");
    expect(html).toContain("Projet envoyé");
    expect(html).toContain("Paiement confirmé");
    expect(html).toContain("Atelier sélectionné");
    expect(html).not.toMatch(/commercial_proposal|marketplace_events|event_type/);
  });

  it("range l'information secondaire derrière « Voir tous les détails »", () => {
    const html = detail("MA_RELIURE", "E");
    expect(html).toContain("Voir tous les détails");
    // Ce que nous devons encore confirmer n'encombre pas le haut de page.
    expect(html.indexOf("Ce que nous devons encore confirmer")).toBeGreaterThan(html.indexOf("Voir tous les détails"));
    expect(html).not.toContain("Informations manquantes");
    expect(html).not.toMatch(/Hypothèse par défaut|Règle du playbook|Hypothèse IA/);
  });

  it("l'ordre est : en-tête, prochaine étape, proposition, résumé, photos, atelier, messages, historique", () => {
    const html = detail("MA_RELIURE", "H");
    const order = ["<h1", "Prochaine étape", "Votre proposition", "Résumé de votre projet", "Photos", "L&#x27;atelier retenu", 'id="messages"', "Historique", "Voir tous les détails"];
    let last = -1;
    for (const marker of order) {
      const at = html.indexOf(marker);
      expect(at, marker).toBeGreaterThan(last);
      last = at;
    }
  });
});

describe("langue", () => {
  it("Fine Bindery : aucun mot français ni Ma Reliure dans tout le détail", () => {
    for (const scenario of SCENARIOS) {
      const html = detail("FINE_BINDERY", scenario);
      expect(html, scenario).not.toMatch(/Ma Reliure|mareliure/i);
      expect(html, scenario).not.toMatch(/\b(Votre|Mes livres|Prochaine étape|Historique|Paiement|Payer|Envoyer|Résumé|proposition)\b/);
    }
  });

  it("Ma Reliure : aucune fuite de Fine Bindery ni d'anglais d'interface", () => {
    for (const scenario of SCENARIOS) {
      const html = detail("MA_RELIURE", scenario);
      expect(html, scenario).not.toMatch(/Fine Bindery|finebindery/i);
      expect(html, scenario).not.toMatch(/\b(Next step|Your proposal|My books|Send message|Pay securely|History)\b/);
    }
  });
});

describe("liste", () => {
  it("chaque carte montre un vrai titre, un type, une date, un statut et un lien — pas d'identifiant interne", () => {
    for (const brand of BRANDS) {
      const html = list(brand, "B");
      const titles = brand === "MA_RELIURE" ? ["Le Comte de Monte-Cristo", "Les Fleurs du mal", "Dictionnaire de l&#x27;Académie"] : ["The Count of Monte Cristo", "Flowers of Evil", "Dictionary of the Academy"];
      for (const t of titles) expect(html, t).toContain(t);
      expect(html).not.toMatch(/RL-\d+/);
      for (const id of ["a1", "a2", "a3", "a4"]) expect(html).toContain(`href="/mes-livres/${id}"`);
      expect(html).toContain(brand === "MA_RELIURE" ? "Créé le" : "Created");
      for (const leak of RAW_LEAKS) expect(html, leak).not.toContain(leak);
      expect(html).not.toMatch(/>(pricing|matching|binder_selected|completed|paid)</);
    }
  });

  it("montre le montant TTC, les messages non lus et « Action requise »", () => {
    const html = list("MA_RELIURE", "B");
    expect(html).toContain("478,80");
    expect(html).toContain("TTC");
    expect(html).toContain("2 nouveaux messages");
    expect(html).toContain("Action requise");
    const en = list("FINE_BINDERY", "B");
    expect(en).toContain("2 new messages");
    expect(en).toContain("incl. tax");
    expect(en).toContain("Action required");
  });

  it("place les projets qui attendent le client avant les autres", () => {
    const html = list("MA_RELIURE", "B");
    // a2 (paiement) et a4 (confirmation) attendent le client ; a1 (étude) et a3 (terminé) non.
    const at = (id: string) => html.indexOf(`href="/mes-livres/${id}"`);
    expect(Math.max(at("a2"), at("a4"))).toBeLessThan(Math.min(at("a1"), at("a3")));
    const rows = listFixture("MA_RELIURE", "B");
    expect(sortForCustomer(rows).map((r) => r.id)).toEqual(["a2", "a4", "a1", "a3"]);
  });

  it("une vignette absente laisse un repère, jamais un trou", () => {
    const html = list("MA_RELIURE", "B");
    expect(html).toContain("<svg");
    expect(html).toContain('loading="lazy"');
  });

  it("état vide : un message et un bouton pour présenter un livre, dans la langue de la marque", () => {
    const fr = list("MA_RELIURE", "empty");
    expect(fr).toContain("Aucun projet pour le moment");
    expect(fr).toContain("Présenter un livre");
    expect(fr).toContain('href="/m/reliure-marketplace-token-000001"');
    const en = list("FINE_BINDERY", "empty");
    expect(en).toContain("No projects yet");
    expect(en).toContain("Start a project");
    expect(en).toContain('href="/m/fine-bindery-intake-token-000001"');
    expect(en).not.toContain("Aucun");
  });

  it("le rattachement d'un projet est replié, jamais avant la liste", () => {
    const html = list("MA_RELIURE", "B");
    expect(html).toContain("<details");
    expect(html.indexOf("Le Comte de Monte-Cristo")).toBeLessThan(html.indexOf("Un projet manque à cette liste"));
  });
});

describe("chargement, erreurs, états vides", () => {
  it("un chargement annonce qu'il est en cours et réserve de la hauteur", () => {
    for (const html of [
      renderToStaticMarkup(createElement(PortalListSkeleton, { label: "Chargement…" })),
      renderToStaticMarkup(createElement(PortalDetailSkeleton, { label: "Chargement…" })),
    ]) {
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('role="status"');
      expect(count(html, "animate-pulse")).toBeGreaterThan(2);
    }
  });

  it("une erreur est une phrase claire et un bouton pour réessayer — jamais un message du serveur", () => {
    for (const brand of BRANDS) {
      const copy = customerCopy(brand === "MA_RELIURE" ? "fr-FR" : "en-US");
      const html = renderToStaticMarkup(
        createElement(PortalError, { message: copy.loadError, retryLabel: copy.retry, onRetry: () => {} }),
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain(brand === "MA_RELIURE" ? "Impossible de charger ce projet. Réessayez." : "We couldn&#x27;t load this project. Please try again.");
      expect(html).toContain(brand === "MA_RELIURE" ? "Réessayer" : "Try again");
    }
  });

  it("aucune page client n'affiche un message d'erreur venu du serveur", () => {
    for (const file of ["CustomerCasePage.tsx", "CustomerCaseListPage.tsx", "CustomerPortalUi.tsx", "CustomerPhotoGallery.tsx"]) {
      const source = readFileSync(resolve(process.cwd(), "src/marketplace/pages/customer", file), "utf8");
      expect(source, file).not.toMatch(/\(error as Error\)\.message|err\.message|error\.message|\.message\)/);
    }
  });

  it("l'état vide est un composant à part, avec un titre, une phrase et un bouton", () => {
    const html = renderToStaticMarkup(createElement(PortalEmpty, { copy: customerCopy("en-US") }));
    expect(html).toContain("No projects yet");
    expect(html).toContain("Start a project");
  });
});

describe("photos", () => {
  const copy = customerCopy("fr-FR");
  const html = renderToStaticMarkup(
    createElement(CustomerPhotoGallery, {
      copy,
      photos: [
        { url: "https://signed.example/1.webp", caption: null },
        { url: null, caption: null },
      ],
    }),
  );

  it("chaque photo est un bouton nommé, à ratio constant, qui s'agrandit", () => {
    expect(html).toContain('aria-label="Agrandir la photo 1"');
    expect(html).toContain("aspect-[4/3]");
    expect(html).toContain('loading="lazy"');
    expect(html).toContain("<button");
  });

  it("une photo sans URL montre un repère « indisponible », pas un trou", () => {
    expect(html).toContain("Photo indisponible");
  });

  it("ne connaît jamais un chemin de stockage ni un bucket", () => {
    const source = stripComments(
      readFileSync(resolve(process.cwd(), "src/marketplace/pages/customer/CustomerPhotoGallery.tsx"), "utf8"),
    );
    expect(source).not.toMatch(/storagePath|createSignedUrl|\.storage\.|bucket/i);
  });
});

describe("paiement : conditions du bouton", () => {
  const source = readFileSync(resolve(process.cwd(), "src/marketplace/pages/customer/CustomerCasePage.tsx"), "utf8");

  it("le bouton n'existe qu'une fois, dans « Prochaine étape », et seulement si le serveur l'autorise", () => {
    expect(count(source, "<PayButton")).toBe(1);
    expect(source).toContain('next.action === "pay" && canPay');
    expect(source).toContain("canPay={data.case.paymentEligible}");
  });

  it("le client ne transmet jamais de montant : seul le caseId part", () => {
    expect(source).toContain("createSession({ data: { caseId } })");
    expect(source).not.toMatch(/amount|cents.*createSession|createSession.*cents/i);
  });

  it("une erreur de paiement n'est jamais celle de Stripe ou du serveur", () => {
    expect(source).toContain("onError: () => setFailed(true)");
    expect(source).toContain("copy.payError");
  });
});

describe("messagerie : aucun nouveau canal", () => {
  it("le détail n'ajoute aucun lien direct vers l'atelier ; le fil reste celui du serveur", () => {
    for (const brand of BRANDS) {
      const html = detail(brand, "G");
      expect(html).toContain('id="messages"');
      expect(html).not.toMatch(/mailto:|tel:/);
      // Le titre du fil n'affirme pas un canal atelier direct pour Fine Bindery.
      expect(html).not.toMatch(/Conversation with your workshop|Conversation avec votre atelier/);
    }
  });
});
