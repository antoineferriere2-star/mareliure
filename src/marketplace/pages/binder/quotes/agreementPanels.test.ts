/**
 * Écrans de l'audit #53 (C1, C2, C4), rendus en HTML avec des données de test : la vraie mise en
 * page, sans serveur ni routeur (environnement node, sans DOM ; les clics ne sont pas couverts).
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

const workspace = { isFineBindery: false, locale: "fr" as string, setLocale: () => undefined };
vi.mock("@/marketplace/i18n/FineBinderyWorkspaceContext", () => ({ useFineBinderyWorkspace: () => workspace }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, params, children }: { to: string; params?: Record<string, string>; children?: ReactNode }) =>
    createElement("a", { href: params ? to.replace(/\$(\w+)/g, (_m, key: string) => params[key] ?? "") : to }, children),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => () => Promise.resolve(undefined), createServerFn: () => ({}) }));
vi.mock("@/marketplace/services/externalSettlement.data.functions", () => ({
  getAgreementIdentity: {}, completeAgreementIdentity: {}, getExternalSettlements: {}, recordExternalSettlement: {},
}));

const { ContractBlockerNotice, AgreementIdentityPanel } = await import("./AgreementPanels");
const { ExternalSettlementPanel } = await import("./ExternalSettlementPanel");
const { SETTLEMENT_UNAVAILABLE } = await import("./settlementCopy");
const { NoWorkshopNotice } = await import("../NoWorkshopNotice");

function render(node: ReactNode, cache: [unknown[], unknown][] = []) {
  const client = new QueryClient();
  for (const [key, value] of cache) client.setQueryData(key, value);
  return renderToStaticMarkup(createElement(QueryClientProvider, { client }, node));
}
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

describe("blocage explicite de l'acceptation (C1/C2)", () => {
  it("explique l'identifiant manquant sans imposer un SIRET hors de France, et propose profil + duplication", () => {
    const html = render(createElement(ContractBlockerNotice, { blocker: "seller_identity_missing", onDuplicate: () => undefined, duplicating: false }));
    expect(text(html)).toContain("hors de France, le numéro d'immatriculation de votre entreprise");
    expect(html).toContain('href="/atelier/tarifs"');
    expect(text(html)).toContain("Dupliquer ce devis");
  });
  it("demande d'envoyer le devis avant l'accord, sans proposer de duplication", () => {
    const html = text(render(createElement(ContractBlockerNotice, { blocker: "send_first", onDuplicate: () => undefined, duplicating: false })));
    expect(html).toContain("marquez-le d'abord comme envoyé");
    expect(html).not.toContain("Dupliquer");
  });
});

describe("identité vendeur d'un accord enregistré (C1)", () => {
  const panel = (state: string) => text(render(createElement(AgreementIdentityPanel, { quoteId: "q1" }), [[["agreement-identity", "q1"], { agreement: true, state, attestation: null }]]));
  it("propose l'attestation et rappelle qu'un changement de vendeur exige un nouvel accord", () => {
    const html = panel("attestation_required");
    expect(html).toContain("J'atteste qu'il s'agit du même vendeur");
    expect(html).toContain("Si le vendeur a changé");
    expect(html).toContain("l'accord, qui reste inchangé");
  });
  it("refuse l'attestation d'un autre vendeur et oriente vers un nouvel accord", () => {
    const html = panel("seller_changed");
    expect(html).not.toContain("J'atteste");
    expect(html).toContain("dupliquez le devis d'origine");
  });
  it("demande d'abord l'identifiant au profil", () => {
    expect(panel("profile_identifier_missing")).toContain("Ajoutez-le d'abord à votre profil");
  });
  it("ne montre rien pour un accord complet ou hors circuit", () => {
    expect(panel("complete").trim()).toBe("");
    expect(text(render(createElement(AgreementIdentityPanel, { quoteId: "q1" }), [[["agreement-identity", "q1"], { agreement: false }]])).trim()).toBe("");
  });
});

describe("factures sans suivi des règlements : raison et orientation (C2)", () => {
  it.each(Object.keys(SETTLEMENT_UNAVAILABLE))("affiche la raison %s", (reason) => {
    const html = text(render(createElement(ExternalSettlementPanel, { invoiceId: "i1" }), [[["external-settlement", "i1"],
      { eligible: false, reason, currency: "EUR", totalCents: 1, netCents: 0, disputed: false, events: [] }]]));
    expect(html).toContain(SETTLEMENT_UNAVAILABLE[reason as keyof typeof SETTLEMENT_UNAVAILABLE].slice(0, 40));
    expect(html).toContain("Aucun paiement en ligne n'est activé");
  });
});

describe("compte sans atelier (C4)", () => {
  it("oriente vers la page partenaires Ma Reliure", () => {
    Object.assign(workspace, { isFineBindery: false, locale: "fr" });
    const html = render(createElement(NoWorkshopNotice));
    expect(text(html)).toContain("Aucun atelier n'est associé à ce compte.");
    expect(html).toContain('href="/partenaires-relieurs"');
  });
  it.each([["en", "No workshop is linked to this account."], ["de", "Werkstatt"], ["it", "laboratorio"], ["es", "taller"]])("traduit pour Fine Bindery (%s)", (locale, expected) => {
    Object.assign(workspace, { isFineBindery: true, locale });
    const html = render(createElement(NoWorkshopNotice));
    expect(text(html)).toContain(expected);
    expect(html).toContain(`href="/${locale}/professionals"`);
    expect(html).not.toContain("no_binder");
  });
});
