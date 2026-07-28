import { describe, expect, it } from "vitest";
import {
  validateBetaRequest,
  validateContactRequest,
  type BetaRequestInput,
  type ContactRequestInput,
} from "./buildPublicForms";

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

function makeContactRequest(overrides: Partial<ContactRequestInput> = {}): ContactRequestInput {
  return {
    name: "Jane Miller",
    email: "jane@example.com",
    company: "Sunrise Decks",
    subject: "Setup question",
    message: "Can you help us connect a guided intake to our website?",
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

describe("validateContactRequest", () => {
  it("accepts a complete contact message", () => {
    expect(validateContactRequest(makeContactRequest())).toEqual([]);
  });

  it("does not require a company", () => {
    expect(validateContactRequest(makeContactRequest({ company: "" }))).toEqual([]);
  });

  it("requires a sender name", () => {
    expect(validateContactRequest(makeContactRequest({ name: "" }))).toContain("Name is required.");
  });

  it("rejects an invalid email", () => {
    expect(validateContactRequest(makeContactRequest({ email: "not-an-email" }))).toContain(
      "Enter a valid email.",
    );
  });

  it("requires a subject and message", () => {
    expect(validateContactRequest(makeContactRequest({ subject: "" }))).toContain(
      "Subject is required.",
    );
    expect(validateContactRequest(makeContactRequest({ message: "" }))).toContain(
      "Message is required.",
    );
  });

  it("requires consent", () => {
    expect(validateContactRequest(makeContactRequest({ consent: false }))).toContain(
      "Consent is required.",
    );
  });

  it("fails the honeypot silently as a spam check", () => {
    expect(validateContactRequest(makeContactRequest({ website: "spam" }))).toContain(
      "Spam check failed.",
    );
  });
});
