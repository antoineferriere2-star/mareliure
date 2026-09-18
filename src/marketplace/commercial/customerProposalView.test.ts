import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { toCustomerProposalView, type CustomerProposalSource } from "./customerProposalView";

/**
 * Une ligne complète de `marketplace_commercial_proposals`, avec tout ce qu'un
 * client ne doit JAMAIS recevoir : rémunération de l'atelier, marge, planchers
 * de contribution, multiplicateur de marque, provenance du Pricebook.
 */
const fullRow = {
  id: "p1",
  caseId: "c1",
  version: 2,
  brand: "MA_RELIURE",
  currency: "EUR",
  pricingMode: "FIXED_PRICE" as const,
  pricingRuleVersion: "bookbinding-2026-09-16-v5",
  pricebookReferenceCents: 31000,
  pricebookProvenance: [{ work: "x" }],
  brandMultiplierBps: 10000,
  brandReferenceCents: 31000,
  binderPayoutCents: 22000,
  binderVatRateBps: 0,
  binderVatAmountCents: 0,
  binderPayoutTtcCents: 22000,
  targetMarginBps: 3000,
  minimumContributionCents: 8000,
  marginFloorCents: 9000,
  contributionFloorCents: 8000,
  priceBoundBy: "reference",
  customerServicePriceCents: 37500,
  estimateMinCents: null,
  estimateMaxCents: null,
  shippingOutboundCents: 1200,
  shippingReturnCents: 1200,
  shippingOtherCents: 0,
  shippingTotalCents: 2400,
  shippingMarginCents: 0,
  shippingHandlingFeeCents: 0,
  taxPolicy: "FRANCE_STANDARD",
  customerVatRateBps: 2000,
  customerVatAmountCents: 7980,
  customerTotalHtCents: 39900,
  customerTotalTtcCents: 47880,
  taxCountry: "FR",
  taxBasis: "x",
  taxValidatedBy: "admin-user",
  customerType: "CUSTOMER",
  businessName: null,
  businessVatNumber: null,
  billingCountry: "FR",
  depositType: "NONE",
  depositAmountCents: 0,
  balanceDueCents: 39900,
  status: "accepted",
  notes: "note interne : client difficile",
  createdAt: "2026-09-13T09:00:00Z",
  createdBy: "admin-user",
  validatedBy: "admin-user",
  acceptedAt: "2026-09-14T10:00:00Z",
} as unknown as CustomerProposalSource;

const FORBIDDEN =
  /payout|binder|margin|contribution|pricebook|multiplier|floor|priceBound|ruleVersion|createdBy|validatedBy|taxValidated|notes|admin-user|difficile|brandReference|deposit/i;

describe("vue client d'une proposition", () => {
  it("n'expose que la liste blanche, jamais un champ interne", () => {
    const view = toCustomerProposalView(fullRow);
    expect(Object.keys(view).sort()).toEqual(
      [
        "confirmedAt",
        "currency",
        "estimateMaxCents",
        "estimateMinCents",
        "pricingMode",
        "preparedAt",
        "serviceCents",
        "shippingCents",
        "totalHtCents",
        "totalTtcCents",
        "vatCents",
        "vatRateBps",
      ].sort(),
    );
    const serialised = JSON.stringify(view);
    expect(serialised).not.toMatch(FORBIDDEN);
    for (const secret of ["22000", "3000", "8000", "9000", "31000", "bookbinding-2026"]) {
      expect(serialised).not.toContain(secret);
    }
  });

  it("reprend les montants du snapshot figé, sans rien recalculer", () => {
    const view = toCustomerProposalView(fullRow);
    expect(view.serviceCents).toBe(37500);
    expect(view.shippingCents).toBe(2400);
    expect(view.totalHtCents).toBe(39900);
    expect(view.vatCents).toBe(7980);
    expect(view.vatRateBps).toBe(2000);
    expect(view.totalTtcCents).toBe(47880);
  });

  it("ne devine jamais une taxe : une fiscalité non déterminée reste vide", () => {
    const view = toCustomerProposalView({
      ...fullRow,
      customerVatRateBps: null,
      customerVatAmountCents: null,
      customerTotalTtcCents: null,
    });
    expect(view.vatRateBps).toBeNull();
    expect(view.vatCents).toBeNull();
    expect(view.totalTtcCents).toBeNull();
  });

  it("n'a aucun `...spread` : l'ajout d'une colonne ne change pas ce qu'un client reçoit", () => {
    const source = readFileSync(resolve(process.cwd(), "src/marketplace/commercial/customerProposalView.ts"), "utf8");
    const body = source.slice(source.indexOf("export function toCustomerProposalView"));
    expect(body).not.toContain("...");
  });
});

/** Le code sans ses commentaires : un commentaire peut citer ce que le code s'interdit. */
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("le chargeur client du commerce", () => {
  const source = stripComments(
    readFileSync(resolve(process.cwd(), "src/marketplace/services/customerCommerce.server.ts"), "utf8"),
  );

  it("garde le même garde-fou de paiement que le Checkout (checkoutEligibility)", () => {
    expect(source).toContain("checkoutEligibility({");
    for (const input of ["status", "acceptedAt", "taxPolicy", "taxValidatedAt", "customerType", "businessName", "alreadyPaid"]) {
      expect(source).toContain(input);
    }
    expect(source).toContain("toCustomerProposalView(accepted)");
  });

  it("ne renvoie jamais la ligne de proposition brute", () => {
    expect(source).not.toMatch(/proposal:\s*accepted\b/);
    // Lecture seule : il importe la décision d'éligibilité (checkoutPlan, pure),
    // jamais le client Stripe ni la création d'une session.
    expect(source).not.toMatch(/stripeClient|stripeConfig|new Stripe|checkout\.sessions|createCheckoutSession|createCommercialCheckoutSession/);
  });
});

describe("les server functions de l'espace client", () => {
  const source = stripComments(
    readFileSync(resolve(process.cwd(), "src/marketplace/services/marketplace.data.functions.ts"), "utf8"),
  );
  const customerSection = source.slice(source.indexOf("export const listMyCustomerCases"), source.indexOf("export const claimMarketplaceCase"));

  it("le détail renvoie la vue client en liste blanche, jamais la ligne de proposition", () => {
    expect(customerSection).toContain("proposal: commerce.proposal");
    expect(customerSection).not.toMatch(/loadAcceptedCommercialProposal|listCommercialProposals|loadLatestCommercialProposal/);
    expect(customerSection).not.toMatch(/binder_payout|binderPayout|margin|contribution/i);
  });

  it("la liste et le détail s'appuient sur le même chargeur — donc le même garde-fou de paiement", () => {
    expect((customerSection.match(/loadCustomerCommerce\(/g) ?? []).length).toBe(2);
    expect(customerSection).not.toContain("checkoutEligibility(");
  });

  it("la liste ne montre un prix que s'il est validé, comme le détail", () => {
    expect(customerSection).toContain('row.pricing_status === "validated"');
  });

  it("l'accès reste celui d'avant : propriétaire du dossier, vérifié côté serveur", () => {
    expect(customerSection).toContain('.eq("customer_user_id", context.userId)');
    expect(customerSection).toContain("canViewCase(viewer, facts)");
    expect(customerSection).toContain("caseDisclosure(viewer, facts)");
  });
});
