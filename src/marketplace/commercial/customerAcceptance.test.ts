import { describe, expect, it } from "vitest";
import { checkoutEligibility } from "@/marketplace/stripe/checkoutPlan";
import { customerAcceptance, type CustomerAcceptanceInput } from "./customerAcceptance";

const ok: CustomerAcceptanceInput = {
  status: "proposed",
  acceptedAt: null,
  supersededAt: null,
  taxPolicy: "FRANCE_STANDARD_VAT",
  taxValidatedAt: "2026-09-18T09:00:00.000Z",
  customerType: "CUSTOMER",
  businessName: null,
  casePriceValidated: true,
  caseStatus: "matching",
};
const verdict = (over: Partial<CustomerAcceptanceInput>) => customerAcceptance({ ...ok, ...over });

describe("quand un client peut accepter sa proposition", () => {
  it("une proposition présentée, au prix validé et à la fiscalité validée, est acceptable", () => {
    expect(verdict({})).toEqual({ acceptable: true });
  });

  it.each([
    ["déjà acceptée", { acceptedAt: "2026-09-19T10:00:00.000Z" }, "already_accepted"],
    ["en préparation (draft)", { status: "draft" }, "not_open"],
    ["retirée", { status: "cancelled" }, "not_open"],
    ["remplacée", { status: "superseded" }, "not_open"],
    ["marquée remplacée par sa date", { supersededAt: "2026-09-19T08:00:00.000Z" }, "not_open"],
    ["prix non validé", { casePriceValidated: false }, "price_not_validated"],
    ["fiscalité à revoir", { taxPolicy: "MANUAL_TAX_REVIEW", taxValidatedAt: null }, "tax_review_required"],
    ["fiscalité sans date de validation", { taxValidatedAt: null }, "tax_review_required"],
    ["politique « à revoir » malgré une date", { taxPolicy: "MANUAL_TAX_REVIEW" }, "tax_review_required"],
    ["professionnel sans raison sociale", { customerType: "BUSINESS", businessName: null }, "business_identity_incomplete"],
    ["projet annulé", { caseStatus: "cancelled" }, "case_closed"],
    ["projet terminé", { caseStatus: "completed" }, "case_closed"],
    ["projet livré", { caseStatus: "delivered" }, "case_closed"],
  ] as [string, Partial<CustomerAcceptanceInput>, string][])("refuse une proposition %s", (_label, over, reason) => {
    expect(verdict(over)).toEqual({ acceptable: false, reason });
  });

  it("un client professionnel dont l'identité est complète peut accepter", () => {
    expect(verdict({ customerType: "BUSINESS", businessName: "Atelier Test SARL" })).toEqual({ acceptable: true });
  });

  it("une proposition acceptable est toujours payable une fois acceptée — même règle que le Checkout", () => {
    const cases: Partial<CustomerAcceptanceInput>[] = [
      {},
      { customerType: "BUSINESS", businessName: "SARL" },
      { customerType: "BUSINESS", businessName: null },
      { taxPolicy: "MANUAL_TAX_REVIEW", taxValidatedAt: null },
      { taxValidatedAt: null },
    ];
    for (const over of cases) {
      const input = { ...ok, ...over };
      if (!customerAcceptance(input).acceptable) continue;
      // Acceptable ⇒ après acceptation, `checkoutEligibility` répond « payable ».
      expect(
        checkoutEligibility({
          status: "accepted",
          acceptedAt: "2026-09-19T10:00:00.000Z",
          taxPolicy: input.taxPolicy,
          taxValidatedAt: input.taxValidatedAt,
          customerType: input.customerType,
          businessName: input.businessName,
          alreadyPaid: false,
        }).eligible,
        JSON.stringify(over),
      ).toBe(true);
    }
  });
});
