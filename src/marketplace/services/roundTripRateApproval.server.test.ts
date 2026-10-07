import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSendcloudShippingOptions, type ShippingOptionView } from "@/marketplace/shipping/sendcloudProvider.server";
import { loadAcceptedCommercialProposal } from "./commercialProposalRepository.server";
import { recordRateApproval, type RateApprovalInput } from "./roundTripAutomation.server";

vi.mock("@/marketplace/shipping/sendcloudProvider.server", () => ({ fetchSendcloudShippingOptions: vi.fn(), createSendcloudProvider: vi.fn() }));
vi.mock("./commercialProposalRepository.server", () => ({ loadAcceptedCommercialProposal: vi.fn() }));

const option = (code: string, overrides: Partial<ShippingOptionView> = {}): ShippingOptionView => ({
  code, name: code, carrier: "Fixture", firstMile: null, lastMile: "home_delivery", returns: false,
  servicePointRequired: false, chargingType: null, priceCents: 517, currency: "EUR", ...overrides,
});
const input: RateApprovalInput = {
  outboundOptionCode: " outbound-home ", returnOptionCode: " return-home ",
  providerQuoteReference: "fixture quote", coverageEvidenceReference: "fixture coverage",
  outboundCostTtcCents: 620, returnCostTtcCents: 620, allOtherCostsTtcCents: 0,
  estimatedEconomicCostCents: 1034, economicCostEvidenceReference: "fixture cost", validUntil: "2026-10-08T12:00:00Z",
};
function client() {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const row = {
    address_line1: "1 rue fictive", contact_name: "Recette fictive", postal_code: "75011", city: "Paris", country_code: "FR",
    return_same_address: false, return_address_line1: "2 rue fictive", return_contact_name: "Recette fictive",
    return_postal_code: "33000", return_city: "Bordeaux", return_country_code: "FR",
    parcel_weight_grams: 500, parcel_length_mm: 350, parcel_width_mm: 250, parcel_height_mm: 80,
    workshop_decision: "accepted", workshop_binder_id: "fixture-binder", workshop_address_line1: "3 rue fictive",
    workshop_reception_name: "Atelier fictif", workshop_postal_code: "69002", workshop_city: "Lyon", workshop_country_code: "FR",
    return_ready_at: "2026-10-07T12:00:00Z", return_weight_grams: 700, return_length_mm: 360, return_width_mm: 260, return_height_mm: 90,
  };
  const q = { select: () => q, eq: vi.fn(() => q), maybeSingle: async () => ({ data: row, error: null }) };
  return { insert, q, sb: { from: (table: string) => {
    if (table === "marketplace_case_logistics_plans") return q;
    if (table === "marketplace_round_trip_rate_approvals") return { insert };
    throw new Error(`unexpected table: ${table}`);
  } } };
}

beforeEach(() => {
  vi.stubEnv("SENDCLOUD_PUBLIC_KEY", "test-only"); vi.stubEnv("SENDCLOUD_SECRET_KEY", "test-only");
  vi.mocked(loadAcceptedCommercialProposal).mockResolvedValue({ id: "fixture-proposal", shippingOfferKind: "book_round_trip_fr" } as never);
});
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });

describe("enregistrement du tarif contre les deux devis fournisseur", () => {
  it.each([
    ["aller relais", [option("outbound-home", { servicePointRequired: true })], [option("return-home")]],
    ["retour relais", [option("outbound-home")], [option("return-home", { servicePointRequired: true })]],
    ["code retour absent", [option("outbound-home")], [option("other-home")]],
    ["retour sans prix", [option("outbound-home")], [option("return-home", { priceCents: null })]],
    ["retour autre devise", [option("outbound-home")], [option("return-home", { currency: "GBP" })]],
  ])("%s : aucune approbation écrite", async (_name, outbound, back) => {
    vi.mocked(fetchSendcloudShippingOptions).mockResolvedValueOnce(outbound).mockResolvedValueOnce(back);
    const c = client();
    await expect(recordRateApproval(c.sb as never, "fixture-actor", "fixture-case", input)).rejects.toMatchObject({ code: "rate_method_unavailable" });
    expect(c.insert).not.toHaveBeenCalled();
  });
  it("une réponse fournisseur indisponible ne valide pas le tarif", async () => {
    vi.mocked(fetchSendcloudShippingOptions).mockResolvedValueOnce([option("outbound-home")]).mockResolvedValueOnce("unavailable");
    const c = client();
    await expect(recordRateApproval(c.sb as never, "fixture-actor", "fixture-case", input)).rejects.toMatchObject({ code: "provider_unavailable" });
    expect(c.insert).not.toHaveBeenCalled();
  });
  it("utilise les trajets et colis distincts puis enregistre les codes normalisés", async () => {
    vi.mocked(fetchSendcloudShippingOptions).mockResolvedValueOnce([option("outbound-home")]).mockResolvedValueOnce([option("return-home")]);
    const c = client();
    await recordRateApproval(c.sb as never, "fixture-actor", "fixture-case", input);
    expect(fetchSendcloudShippingOptions).toHaveBeenNthCalledWith(1, { publicKey: "test-only", secretKey: "test-only" }, {
      fromCountry: "FR", fromPostalCode: "75011", toCountry: "FR", toPostalCode: "69002", weightGrams: 500, dimensionsMm: [350, 250, 80],
    });
    expect(fetchSendcloudShippingOptions).toHaveBeenNthCalledWith(2, { publicKey: "test-only", secretKey: "test-only" }, {
      fromCountry: "FR", fromPostalCode: "69002", toCountry: "FR", toPostalCode: "33000", weightGrams: 700, dimensionsMm: [360, 260, 90],
    });
    expect(c.insert).toHaveBeenCalledOnce();
    expect(c.insert).toHaveBeenCalledWith(expect.objectContaining({ case_id: "fixture-case", proposal_id: "fixture-proposal",
      binder_id: "fixture-binder", reviewed_by: "fixture-actor", outbound_method: "outbound-home", return_method: "return-home",
      outbound_weight_grams: 500, return_weight_grams: 700, outbound_dimensions_mm: [350, 250, 80], return_dimensions_mm: [360, 260, 90],
    }));
  });
});
