import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { HOW_IT_WORKS_STEPS, PARTNER_FAQ } from "@/marketplace/pages/landing/partnersContent";
import { PLATFORM_FEE_LABEL, SUBSCRIPTION_LABEL, WORKSHOP_OFFER, formatHtPrice } from "./workshopOffer";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("l'offre atelier", () => {
  it("fixe les montants du modèle : 15 € HT par mois, 3 % du TTC encaissé, règlement sous 30 jours", () => {
    expect(formatHtPrice(1500)).toBe("15 € HT");
    expect(SUBSCRIPTION_LABEL).toBe("15 € HT par mois");
    expect(PLATFORM_FEE_LABEL).toBe("3 %");
    expect(WORKSHOP_OFFER.workshopPaymentDays).toBe(30);
  });

  it("ouvre B après recette et conserve C fermé et les gratuités historiques", () => {
    const faq = PARTNER_FAQ.map((item) => item.answer).join(" ");
    expect(WORKSHOP_OFFER.subscriptionOpen).toBe(true);
    expect(WORKSHOP_OFFER.onlinePaymentOpen).toBe(false);
    expect(faq).toContain("18 € TTC");
    expect(faq).toContain("n'est pas encore ouvert");
    expect(faq).toContain("gardent la gratuité tant qu'ils n'ont pas accepté expressément");
  });

  it("dit qui vend, qui facture, qui choisit l'atelier, qui règle", () => {
    const faq = PARTNER_FAQ.map((item) => item.answer).join(" ");
    expect(faq).toMatch(/Oppe vend la prestation au client/);
    expect(faq).toMatch(/vous facturez Oppe/);
    expect(faq).toMatch(/sous 30 jours/);
    expect(HOW_IT_WORKS_STEPS.map((s) => s.title).join(" ")).toMatch(/facturez Oppe/);
  });

  it("ne garde aucune formulation contradictoire dans les contenus publics", () => {
    const sources = [
      "src/marketplace/pages/landing/partnersContent.ts",
      "src/marketplace/pages/partners/PartnersLanding.tsx",
      "src/routes/partenaires-relieurs.tsx",
    ].map(read).join("\n");
    for (const forbidden of [/Gratuit pour votre atelier/, /0 € par mois/, /outil gratuit/i, /commission de paiement plateforme/, /rémunération plateforme/, /modèle envisagé/]) {
      expect(sources).not.toMatch(forbidden);
    }
  });

  it("les CGV des deux marques disent que la marque choisit l'atelier, que le client accepte le devis et qui facture", () => {
    const legal = read("src/marketplace/pages/legal/LegalPages.tsx");
    for (const needle of ["vous ne le choisissez pas lors de votre commande", "you do not choose it when you order", "Vous l'acceptez expressément", "You accept it expressly", "L'atelier qui réalise le travail ne vous facture rien", "does not invoice you: it invoices"]) {
      expect(legal).toContain(needle);
    }
  });
});
