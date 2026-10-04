import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { priceReadyEmailContent } from "./sendPriceToCustomer.data.functions";

const source = readFileSync(resolve(process.cwd(), "src/marketplace/services/sendPriceToCustomer.data.functions.ts"), "utf8");

describe("« Envoyer au client » (proposition construite à la main)", () => {
  it("annonce une proposition à accepter, puis à régler", async () => {
    const { proposalReadyEmailContent } = await import("./sendPriceToCustomer.data.functions");
    const c = proposalReadyEmailContent(13500);
    expect(c.heading).toBe("Votre proposition est prête");
    expect(c.intro).toMatch(/135,00\s€ TTC/);
    expect(c.intro).toContain("acceptez-la");
  });

  it("n'accepte jamais la proposition à la place du client", () => {
    const fn = source.slice(source.indexOf("export const sendProposalToCustomer"));
    expect(fn).not.toContain("acceptCommercialProposalCore");
    expect(fn).toContain("applyAutomaticFranceTaxPolicyCore");
    expect(fn.indexOf('row.brand !== "MA_RELIURE"')).toBeLessThan(fn.indexOf("applyAutomaticFranceTaxPolicyCore(ctx"));
  });
});

describe("« Valider et envoyer au client »", () => {
  it("annonce le montant TTC et le chemin vers le paiement", () => {
    const content = priceReadyEmailContent(20400);
    expect(content.heading).toBe("Le prix de votre projet est prêt");
    expect(content.intro).toMatch(/204,00\s€ TTC/);
    expect(content.intro).toContain("carte bancaire");
    expect(content.ctaLabel).toBe("Voir et régler");
    expect(priceReadyEmailContent(null).intro).not.toMatch(/€/);
  });

  it("enchaîne les quatre gestes manuels dans l'ordre, par leurs fonctions « cœur »", () => {
    const order = ["validateMarketplacePricingCore(ctx", "createCommercialProposalCore(ctx", "applyAutomaticFranceTaxPolicyCore(ctx", "acceptCommercialProposalCore(ctx", "sendTemplateEmail("];
    const positions = order.map((needle) => source.indexOf(needle));
    expect(positions.every((p) => p > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("refuse avant toute écriture Fine Bindery et les dossiers à acompte", () => {
    const firstWrite = source.indexOf("validateMarketplacePricingCore(ctx");
    expect(source.indexOf('row.brand !== "MA_RELIURE"')).toBeLessThan(firstWrite);
    expect(source.indexOf("row.deposit_cents")).toBeLessThan(firstWrite);
  });

  it("n'envoie jamais deux fois le même prix (clé d'idempotence par proposition)", () => {
    expect(source).toContain("emailKey: `price-ready-${proposal.id}`");
    expect(source).toContain("emailKey: `proposal-ready-${proposal.id}`");
    expect(source).toContain("idempotencyKey: input.emailKey");
  });
});
