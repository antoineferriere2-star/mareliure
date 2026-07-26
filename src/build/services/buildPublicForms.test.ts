import { describe, expect, it } from "vitest";
import { validateBetaRequest, type BetaRequestInput } from "./buildPublicForms";

function makeBetaRequest(overrides: Partial<BetaRequestInput> = {}): BetaRequestInput {
  return {
    name: "",
    company: "",
    websiteUrl: "https://example.com",
    role: "",
    businessType: "Deck builder",
    monthlyInquiries: "11-50",
    currentTools: "",
    mainQualificationProblem: "",
    email: "jane@example.com",
    consent: true,
    website: "",
    ...overrides,
  };
}

describe("validateBetaRequest", () => {
  it("accepts a submission with only the 4-screen guided intake fields filled", () => {
    expect(validateBetaRequest(makeBetaRequest())).toEqual([]);
  });

  it("does not require name, company, role, currentTools or mainQualificationProblem", () => {
    expect(
      validateBetaRequest(
        makeBetaRequest({
          name: "",
          company: "",
          role: "",
          currentTools: "",
          mainQualificationProblem: "",
        }),
      ),
    ).toEqual([]);
  });

  it("rejects an invalid website URL", () => {
    expect(validateBetaRequest(makeBetaRequest({ websiteUrl: "not-a-url" }))).toContain(
      "Enter a valid website URL.",
    );
  });

  it("requires a business type", () => {
    expect(validateBetaRequest(makeBetaRequest({ businessType: "" }))).toContain(
      "Business type is required.",
    );
  });

  it("requires a monthly inquiry range", () => {
    expect(validateBetaRequest(makeBetaRequest({ monthlyInquiries: "" }))).toContain(
      "Choose a monthly inquiry range.",
    );
  });

  it("rejects an invalid email", () => {
    expect(validateBetaRequest(makeBetaRequest({ email: "not-an-email" }))).toContain(
      "Enter a valid email.",
    );
  });

  it("requires consent", () => {
    expect(validateBetaRequest(makeBetaRequest({ consent: false }))).toContain(
      "Consent is required.",
    );
  });

  it("fails the honeypot silently as a spam check", () => {
    expect(validateBetaRequest(makeBetaRequest({ website: "spam" }))).toContain(
      "Spam check failed.",
    );
  });
});
