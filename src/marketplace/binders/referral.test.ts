import { describe, expect, it } from "vitest";
import { isValidReferralSlug, REFERRAL_ANSWER_KEY, slugify } from "./referral";

describe("isValidReferralSlug", () => {
  it("accepts lowercase words joined by single hyphens", () => {
    expect(isValidReferralSlug("atelier-ferriere")).toBe(true);
    expect(isValidReferralSlug("ferriere")).toBe(true);
    expect(isValidReferralSlug("atelier-du-marais-2")).toBe(true);
  });

  it("refuses uppercase, spaces, and other punctuation", () => {
    expect(isValidReferralSlug("Atelier-Ferriere")).toBe(false);
    expect(isValidReferralSlug("atelier ferriere")).toBe(false);
    expect(isValidReferralSlug("atelier_ferriere")).toBe(false);
    expect(isValidReferralSlug("atelier.ferriere")).toBe(false);
    expect(isValidReferralSlug("../etc/passwd")).toBe(false);
  });

  it("refuses leading, trailing or doubled hyphens", () => {
    expect(isValidReferralSlug("-ferriere")).toBe(false);
    expect(isValidReferralSlug("ferriere-")).toBe(false);
    expect(isValidReferralSlug("atelier--ferriere")).toBe(false);
  });

  it("refuses a slug too short or absurdly long to be a real one", () => {
    expect(isValidReferralSlug("ab")).toBe(false);
    expect(isValidReferralSlug("a".repeat(65))).toBe(false);
  });
});

describe("slugify", () => {
  it("lowercases, strips accents, and joins with hyphens", () => {
    expect(slugify("Atelier Ferrière")).toBe("atelier-ferriere");
  });

  it("produces a slug that isValidReferralSlug accepts", () => {
    expect(isValidReferralSlug(slugify("Le Petit Atelier — Reliure & Restauration"))).toBe(true);
  });
});

describe("REFERRAL_ANSWER_KEY", () => {
  it("is not a key any real Playbook field would use", () => {
    // Reserved-key convention: an underscore prefix, so a Playbook field
    // named the same way by coincidence would be an unmistakable collision to
    // spot in review, not a silent one.
    expect(REFERRAL_ANSWER_KEY.startsWith("_")).toBe(true);
  });
});
