import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PARTNER_FAQ } from "@/marketplace/pages/landing/partnersContent";
import { SUBSCRIPTION_LABEL, WORKSHOP_OFFER, formatHtPrice } from "./workshopOffer";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("l'offre atelier", () => {
  it("fixe le seul revenu d'Oppe : 19,90 € HT par mois, et aucun paiement en ligne ouvert", () => {
    expect(formatHtPrice(1990)).toBe("19,90 € HT");
    expect(SUBSCRIPTION_LABEL).toBe("19,90 € HT par mois");
    expect(WORKSHOP_OFFER.onlinePaymentOpen).toBe(false);
  });

  it("annonce l'essai de 14 jours et conserve les gratuités historiques, sans ancien prix", () => {
    const faq = PARTNER_FAQ.map((item) => item.answer).join(" ");
    expect(faq).toContain("19,90 € HT");
    expect(faq).toContain("Essai gratuit de 14 jours");
    expect(faq).not.toMatch(/18 € TTC|15 € HT/);
    expect(faq).toContain("gardent la gratuité tant qu'ils n'ont pas accepté expressément");
  });

  it("dit que l'atelier vend et que le client le règle directement, sans frais Oppe", () => {
    const faq = PARTNER_FAQ.map((item) => item.answer).join(" ");
    expect(faq).toMatch(/Oppe n'encaisse aucun paiement et ne prélève aucun frais/);
    expect(faq).not.toMatch(/Oppe prélève|2,50 € HT/);
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
