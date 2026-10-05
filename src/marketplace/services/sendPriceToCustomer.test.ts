import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { proposalReadyEmailContent } from "./sendPriceToCustomer.data.functions";

const source = readFileSync(resolve(process.cwd(), "src/marketplace/services/sendPriceToCustomer.data.functions.ts"), "utf8");
const proposalSource = readFileSync(resolve(process.cwd(), "src/marketplace/services/commercialProposal.data.functions.ts"), "utf8");

describe("« Créer et envoyer le devis au client » (modèle Oppe)", () => {
  it("annonce un devis à accepter avec les conditions de vente, puis à régler", () => {
    const fr = proposalReadyEmailContent(24_000);
    expect(fr.heading).toBe("Votre devis est prêt");
    expect(fr.intro).toMatch(/240,00\s€ TTC/);
    expect(fr.intro).toContain("acceptez-le avec les conditions générales de vente");
    const en = proposalReadyEmailContent(24_000, "FINE_BINDERY");
    expect(en.heading).toBe("Your quote is ready");
    expect(en.intro).toContain("accept it and the terms of sale");
    expect(proposalReadyEmailContent(null).intro).not.toMatch(/€/);
  });

  it("n'accepte jamais le devis à la place du client", () => {
    expect(source).not.toMatch(/acceptCommercialProposal|accepted_at|status: "accepted"/);
    expect(proposalSource).not.toContain("export const acceptCommercialProposal");
  });

  it("crée, applique la fiscalité automatique quand elle existe, puis envoie — dans cet ordre", () => {
    const order = ["createCommercialProposalCore(ctx", "return sendDraft(sb, ctx"];
    const positions = order.map((needle) => source.indexOf(needle));
    expect(positions.every((p) => p > 0)).toBe(true);
    const draft = source.slice(source.indexOf("async function sendDraft"));
    expect(draft.indexOf("applyAutomaticFranceTaxPolicyCore(ctx")).toBeLessThan(draft.indexOf("markCommercialProposalSent(sb"));
    expect(draft.indexOf('reason: "tax_review_required"')).toBeLessThan(draft.indexOf("markCommercialProposalSent(sb"));
  });

  it("exige l'accord de l'atelier retenu avant tout devis", () => {
    expect(proposalSource).toContain("loadSelectedWorkshopAgreement(sb, data.caseId)");
    expect(proposalSource.indexOf("loadSelectedWorkshopAgreement(sb, data.caseId)")).toBeLessThan(
      proposalSource.indexOf("insertCommercialProposal(sb, snapshot"),
    );
  });

  it("refuse les dossiers à acompte avant toute écriture", () => {
    const fn = source.slice(source.indexOf("export const sendPriceToCustomer"));
    expect(fn.indexOf("row.deposit_cents")).toBeLessThan(fn.indexOf("createCommercialProposalCore(ctx"));
  });

  it("n'envoie jamais deux fois le même devis (clé d'idempotence par devis)", () => {
    expect(source).toContain("idempotencyKey: `proposal-ready-${input.proposalId}`");
  });
});
