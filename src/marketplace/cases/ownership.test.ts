import { describe, expect, it } from "vitest";
import { decideClaim, extractAccessToken, verifiedEmailFromClaims } from "./ownership";

const ME = "user-marie";
const SOMEONE_ELSE = "user-paul";

describe("claiming a case", () => {
  it("succeeds on a case nobody owns", () => {
    expect(decideClaim({ currentOwnerId: null, requesterId: ME })).toEqual({
      allowed: true,
      alreadyOwned: false,
    });
  });

  it("is idempotent: claiming what you already own succeeds and changes nothing", () => {
    // A customer who clicks the link in their e-mail twice must not see an
    // error the second time.
    expect(decideClaim({ currentOwnerId: ME, requesterId: ME })).toEqual({
      allowed: true,
      alreadyOwned: true,
    });
  });

  it("refuses a case someone else owns, and never transfers it", () => {
    const decision = decideClaim({ currentOwnerId: SOMEONE_ELSE, requesterId: ME });
    expect(decision.allowed).toBe(false);
    expect(decision.alreadyOwned).toBe(false);
  });

  it("says nothing about who owns it", () => {
    // The refusal reaches someone who presented a link they should not have.
    // Naming the owner would leak one customer's identity to another.
    const decision = decideClaim({ currentOwnerId: SOMEONE_ELSE, requesterId: ME });
    expect(decision.reason).not.toContain(SOMEONE_ELSE);
  });
});

describe("reading the token out of what the customer pasted", () => {
  const TOKEN = "a".repeat(64);

  it("accepts the bare token", () => {
    expect(extractAccessToken(TOKEN)).toBe(TOKEN);
  });

  it("accepts the whole link people actually paste out of their e-mail", () => {
    expect(extractAccessToken(`https://metre-pro.com/project-summary/${TOKEN}`)).toBe(TOKEN);
    expect(extractAccessToken(`  Voici mon lien : https://x.test/project-summary/${TOKEN}  `)).toBe(
      TOKEN,
    );
  });

  it("is case-insensitive, because mail clients and copy-paste are not", () => {
    expect(extractAccessToken(TOKEN.toUpperCase())).toBe(TOKEN);
  });

  it("refuses anything that is not token-shaped", () => {
    expect(extractAccessToken("")).toBeNull();
    expect(extractAccessToken("bonjour")).toBeNull();
    expect(extractAccessToken("a".repeat(63))).toBeNull();
    // Not hex.
    expect(extractAccessToken("z".repeat(64))).toBeNull();
  });
});

describe("the e-mail rapprochement only trusts a verified address", () => {
  it("accepts an address the provider marked verified, normalised", () => {
    expect(verifiedEmailFromClaims({ email: "  Marie@Example.COM ", email_verified: true })).toBe(
      "marie@example.com",
    );
    expect(
      verifiedEmailFromClaims({
        email: "marie@example.com",
        user_metadata: { email_verified: true },
      }),
    ).toBe("marie@example.com");
  });

  it("refuses an address that is merely present", () => {
    // If e-mail confirmation is off on the project, this returns null for
    // everyone and the rapprochement simply never happens — customers fall
    // back to their link, and nobody inherits a stranger's book.
    expect(verifiedEmailFromClaims({ email: "marie@example.com" })).toBeNull();
    expect(
      verifiedEmailFromClaims({ email: "marie@example.com", email_verified: false }),
    ).toBeNull();
    expect(
      verifiedEmailFromClaims({ email: "marie@example.com", email_verified: "true" }),
    ).toBeNull();
    expect(
      verifiedEmailFromClaims({
        email: "marie@example.com",
        user_metadata: { email_verified: "yes" },
      }),
    ).toBeNull();
  });

  it("refuses a token with no address at all", () => {
    expect(verifiedEmailFromClaims({ email_verified: true })).toBeNull();
    expect(verifiedEmailFromClaims({})).toBeNull();
    expect(verifiedEmailFromClaims({ email: "   ", email_verified: true })).toBeNull();
  });

  it("survives a malformed user_metadata without throwing", () => {
    expect(() =>
      verifiedEmailFromClaims({ email: "marie@example.com", user_metadata: "nope" }),
    ).not.toThrow();
  });
});
