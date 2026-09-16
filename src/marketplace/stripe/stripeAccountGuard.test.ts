import { describe, expect, it } from "vitest";
import { describeAccountMismatch, verifyStripeAccount } from "./stripeAccountGuard";

describe("verifyStripeAccount", () => {
  it("refuse (fail closed) quand aucun compte attendu n'est configuré", () => {
    expect(verifyStripeAccount({ expectedAccountId: null, actualAccountId: "acct_1UGI34K0Q47WbZPf" })).toEqual({
      ok: false,
      reason: "not_configured",
    });
  });

  it("refuse quand la clé Stripe posée répond pour un autre compte", () => {
    expect(
      verifyStripeAccount({
        expectedAccountId: "acct_1UGI34K0Q47WbZPf",
        actualAccountId: "acct_1S530YKEMCwyPCrw",
      }),
    ).toEqual({ ok: false, reason: "mismatch" });
  });

  it("autorise seulement quand le compte réel correspond exactement à celui attendu", () => {
    expect(
      verifyStripeAccount({
        expectedAccountId: "acct_1UGI34K0Q47WbZPf",
        actualAccountId: "acct_1UGI34K0Q47WbZPf",
      }),
    ).toEqual({ ok: true });
  });
});

describe("describeAccountMismatch", () => {
  it("ne renvoie jamais l'un ou l'autre identifiant de compte", () => {
    const message = describeAccountMismatch();
    expect(message).not.toMatch(/acct_/);
  });
});
