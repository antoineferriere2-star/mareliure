import { describe, expect, it } from "vitest";
import { platformRevenue, type FeeAgreement } from "./paymentCircuit";

const fee: FeeAgreement = { acceptedAt: "2026-09-28", version: "qa-v1", currency: "eur", basis: "service_ht", basisCents: 10000, agreedTotalCents: 12000, rateBps: 2500 };
const base = { circuit: "network_sale" as const, collection: "platform" as const, payment: "paid" as const, amountPaidCents: 12000, refundedCents: 0, currency: "eur", agreement: fee };

describe("separate commercial circuits", () => {
  it("never adds 3% to an agreed 25% network fee", () => {
    expect(platformRevenue(base)).toMatchObject({ kind: "fee", amountCents: 2500, basis: "service_ht" });
  });
  it("own-client external collection has no platform payment fee", () => {
    expect(platformRevenue({ ...base, circuit: "own_client", collection: "external" })).toEqual({ kind: "none", amountCents: 0 });
  });
  it.each(["service_ttc", "collected_ttc"] as const)("network commission rejects the unapproved %s basis", basis => {
    expect(platformRevenue({ ...base, agreement: { ...fee, basis } })).toEqual({ kind: "review_required" });
  });
  it("own-client platform collection requires an accepted 3% collection basis", () => {
    expect(platformRevenue({ ...base, circuit: "own_client" })).toEqual({ kind: "review_required" });
    expect(platformRevenue({ ...base, circuit: "own_client", agreement: { ...fee, rateBps: 300, basis: "collected_ttc", basisCents: 12000 } })).toMatchObject({ kind: "fee", amountCents: 360 });
  });
  it.each(["unpaid", "pending", "failed"] as const)("%s does not earn a fee", payment => {
    expect(platformRevenue({ ...base, payment })).toEqual({ kind: "none", amountCents: 0 });
  });
  it("concierge coordination stays separate from atelier work", () => {
    expect(platformRevenue({ ...base, circuit: "concierge" })).toEqual({ kind: "separate_coordination_invoice" });
  });
  it.each([{ agreement: null }, { refundedCents: 1 }, { currency: "usd" }, { amountPaidCents: 5000 }, { amountPaidCents: 11000 }, { agreement: { ...fee, acceptedAt: "" } }])("requires verified agreed terms and refund review: %j", over => {
    expect(platformRevenue({ ...base, ...over })).toEqual({ kind: "review_required" });
  });
  it("does not reinterpret historical resale margin as commission", () => {
    expect(platformRevenue({ ...base, circuit: "legacy_resale" })).toEqual({ kind: "review_required" });
  });
  it("rounds once to the cent", () => {
    expect(platformRevenue({ ...base, agreement: { ...fee, basisCents: 10002 } })).toMatchObject({ amountCents: 2501 });
  });
});
