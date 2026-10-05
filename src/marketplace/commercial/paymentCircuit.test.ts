import { describe, expect, it } from "vitest";
import { platformFeeCents, platformRevenue, type FeeAgreement } from "./paymentCircuit";

const fee: FeeAgreement = { acceptedAt: "2026-10-05", version: "own-c-v1", currency: "eur", basis: "collected_ttc", basisCents: 12000, agreedTotalCents: 12000, rateBps: 300 };
const base = { circuit: "own_client" as const, collection: "platform" as const, payment: "paid" as const, amountPaidCents: 12000, refundedCents: 0, currency: "eur", agreement: fee };

describe("revenus par circuit", () => {
  it("prélève 3 % du TTC encaissé en ligne pour un client propre", () => {
    expect(platformRevenue(base)).toMatchObject({ kind: "fee", amountCents: 360, basis: "collected_ttc" });
  });
  it("ne prélève rien sur un règlement direct", () => {
    expect(platformRevenue({ ...base, collection: "external" })).toEqual({ kind: "none", amountCents: 0 });
  });
  it.each(["unpaid", "pending", "failed"] as const)("%s ne rapporte rien", (payment) => {
    expect(platformRevenue({ ...base, payment })).toEqual({ kind: "none", amountCents: 0 });
  });
  it("traite la vente Oppe comme une marge de revente, jamais une commission", () => {
    expect(platformRevenue({ ...base, circuit: "legacy_resale" })).toEqual({ kind: "resale_margin" });
  });
  it.each(["network_sale", "concierge"] as const)("n'ouvre plus le circuit retiré %s", (circuit) => {
    expect(platformRevenue({ ...base, circuit })).toEqual({ kind: "review_required" });
  });
  it.each([{ agreement: null }, { refundedCents: 1 }, { currency: "usd" }, { amountPaidCents: 11000 }, { agreement: { ...fee, rateBps: 2500 } }, { agreement: { ...fee, acceptedAt: "" } }])("exige des conditions vérifiées : %j", (over) => {
    expect(platformRevenue({ ...base, ...over })).toEqual({ kind: "review_required" });
  });
  it("arrondit une seule fois au centime", () => {
    expect(platformFeeCents(10_017)).toBe(301);
    expect(platformFeeCents(10_016)).toBe(300);
    expect(() => platformFeeCents(-1)).toThrow();
  });
});
