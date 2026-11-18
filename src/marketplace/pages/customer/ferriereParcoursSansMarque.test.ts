// Le parcours de l'atelier Ferrière est intégré dans son site : le visiteur est
// chez l'atelier. Aucun texte du parcours n'y nomme Oppe ni Ma Reliure, mais
// les autres parcours (lien d'atelier /a/:slug, Ma Reliure) gardent leurs avis.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { FERRIERE_PUBLIC_TOKEN, BOOKBINDING_PUBLIC_TOKEN } from "@/build/constants";
import { WorkshopIntakeNotice } from "./WorkshopIntakeCopy";
import { workshopIntakeGuidance } from "./workshopIntakeGuidance";
import { CustomerSpaceOffer } from "./CustomerSpaceOffer";
import { PublicLocaleProvider } from "@/build/pages/public/publicLocale";

const BRAND = /oppe|ma reliure|mareliure/i;
const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node);

describe("parcours de l'atelier Ferrière, sans marque d'outil", () => {
  it("l'avis d'introduction nomme l'atelier, pas l'outil", () => {
    const out = html(createElement(WorkshopIntakeNotice, { stage: "intro", embedded: true }));
    expect(out).toContain("Reliure Ferrière");
    expect(out).not.toMatch(BRAND);
  });

  it("le consentement avant l'envoi nomme l'atelier, pas l'outil", () => {
    const guidance = workshopIntakeGuidance("fr", { embedded: true });
    const consent = guidance.consentTexts?.consentement ?? "";
    expect(consent).toContain("Reliure Ferrière");
    expect(consent).not.toMatch(BRAND);
    expect(guidance.fieldLabels?.consentement).not.toMatch(BRAND);
  });

  it("l'avis de fin et le rappel avant l'envoi n'ont aucune marque non plus", () => {
    for (const stage of ["review", "next"] as const) {
      expect(html(createElement(WorkshopIntakeNotice, { stage, embedded: true }))).not.toMatch(BRAND);
    }
  });

  it("l'offre de suivi, après l'envoi, parle de « votre espace » sans le nom Ma Reliure", () => {
    const out = html(
      createElement(PublicLocaleProvider, { lockedLocale: "fr-FR", children: createElement(CustomerSpaceOffer, { email: "client@example.com", publicToken: FERRIERE_PUBLIC_TOKEN }) }),
    );
    expect(out).toContain("votre espace");
    expect(out).not.toMatch(BRAND);
  });

  it("les autres parcours gardent leurs avis (lien d'atelier, Ma Reliure)", () => {
    expect(html(createElement(WorkshopIntakeNotice, { stage: "intro" }))).toMatch(/Oppe fournit/);
    expect(workshopIntakeGuidance("fr").consentTexts?.consentement).toMatch(/Oppe fournit/);
    const out = html(
      createElement(PublicLocaleProvider, { lockedLocale: "fr-FR", children: createElement(CustomerSpaceOffer, { email: "client@example.com", publicToken: BOOKBINDING_PUBLIC_TOKEN }) }),
    );
    expect(out).toContain("Ma Reliure");
  });

  it("la route de la Mission passe l'option « intégré » à l'avis, au consentement et à l'en-tête", () => {
    const route = readFileSync(resolve(process.cwd(), "src/routes/m.$publicToken.tsx"), "utf8");
    expect(route).toContain('<WorkshopIntakeNotice stage="next" embedded={isFerriereIntake} />');
    expect(route).toContain('workshopIntakeGuidance("fr", { embedded: isFerriereIntake })');
    expect(route).toContain("homeLink={!isFerriereIntake}");
  });
});

describe("pied du parcours Ferrière", () => {
  it("renvoie vers les mentions légales de l'atelier, pas vers celles de la plateforme", () => {
    const route = readFileSync(resolve(__dirname, "../../../routes/m.$publicToken.tsx"), "utf8");
    expect(route).toContain("https://www.reliure-ferriere.fr/mentions-legales/");
    expect(route).toMatch(/legalLink=\{isFerriereIntake \? FERRIERE_LEGAL_LINK : undefined\}/);
  });

  it("le pied intégré n'affiche les pages de la plateforme que sans lien légal propre", () => {
    const shell = readFileSync(resolve(__dirname, "../../../build/pages/public/BuildPublicShell.tsx"), "utf8");
    expect(shell).toMatch(/legalLink \? \(/);
    expect(shell).toContain('"/confidentialite"');
  });
});
