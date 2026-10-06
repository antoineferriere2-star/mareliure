import { describe, expect, it } from "vitest";
import { parseServerError } from "./quoteFormat";

describe("codes d'erreur explicites (audit #53, C1/C2/C4)", () => {
  it.each(["agreement_required", "seller_identity_completion_required", "seller_changed", "no_binder", "workshop_subscription_required"] as const)("reconnaît %s", (code) => {
    expect(parseServerError(new Error(code))).toEqual({ code, missing: [] });
  });
  it("garde profile_incomplete et rejette un message libre", () => {
    expect(parseServerError(new Error("profile_incomplete:SIRET|Adresse"))).toEqual({ code: "profile_incomplete", missing: ["SIRET", "Adresse"] });
    expect(parseServerError(new Error("Aucun atelier no_binder"))).toEqual({ code: "other", missing: [] });
  });
});
