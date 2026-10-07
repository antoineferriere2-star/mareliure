import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { createWorkshopCheckout } from "./workshopSubscription.server";
import { WORKSHOP_SUBSCRIPTION_TERMS } from "@/marketplace/billing/workshopSubscription";
const h = vi.hoisted(() => ({ checkout: vi.fn(), prices: vi.fn(), rate: vi.fn(), guard: vi.fn(), rpc: vi.fn(), customer: vi.fn() }));
vi.mock("./binderMembership.server", () => ({ findActiveBinderMembership: async () => ({ binderId: "workshop", role: "OWNER" }) }));
vi.mock("@/marketplace/stripe/stripeClient.server", () => ({ assertExpectedStripeAccount: h.guard,
  getMarketplaceStripeClient: () => ({ prices: { list: h.prices }, customers: { update: h.customer }, taxRates: { retrieve: h.rate }, checkout: { sessions: { create: h.checkout } } }) }));
vi.mock("@/marketplace/notifications/workshopNotices.server", () => ({ notifyWorkshop: vi.fn() }));
let country: string;
const db = () => ({ rpc: h.rpc, from: (table: string) => {
  const q = { select: () => q, eq: () => q, is: () => q, update: () => q,
    single: async () => ({ error: null, data: table === "marketplace_workshop_offer_settings"
      ? { subscription_open: true } : { legacy_free: true, status: "incomplete", stripe_customer_id: "cus_test", checkout_session_id: null, checkout_expires_at: null } }),
    maybeSingle: async () => ({ error: null, data: { country, postal_code: "75001", city: "Paris", address_line1: "Adresse de recette", legal_name: "Atelier fictif", workshop_name: null, vat_regime: "FRANCHISE", vat_number: null } }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve) };
  return q;
} }) as never;
beforeEach(() => {
  vi.clearAllMocks(); country = "FR";
  vi.stubEnv("WORKSHOP_SUBSCRIPTION_TAX_APPROVED", "true");
  vi.stubEnv("WORKSHOP_SUBSCRIPTION_VAT_RATE_ID", "txr_manual_test");
  vi.stubEnv("WORKSHOP_SUBSCRIPTION_TERMS_READY", WORKSHOP_SUBSCRIPTION_TERMS);
  h.prices.mockResolvedValue({ data: [{ id: "price_existing", unit_amount: 1500, currency: "eur", tax_behavior: "exclusive", recurring: { interval: "month", interval_count: 1 } }] });
  h.rate.mockResolvedValue({ id: "txr_manual_test", percentage: 20, active: true, inclusive: false, country: "FR", tax_type: "vat" });
  h.rpc.mockResolvedValue({ error: null, data: { stripe_customer_id: "cus_test", checkout_session_id: null, checkout_expires_at: "2027-01-01T12:00:00Z" } });
  h.checkout.mockResolvedValue({ id: "cs_test", url: "https://checkout.stripe.com/test" });
});
afterEach(() => vi.unstubAllEnvs());
describe("Checkout B : taux manuel unique et gratuité historique", () => {
  it("conserve le prix 15 HT, ajoute un seul taux 20 et désactive toute taxe automatique", async () => {
    await createWorkshopCheckout(db(), "owner", true);
    expect(h.checkout).toHaveBeenCalledWith(expect.objectContaining({
      line_items: [{ price: "price_existing", quantity: 1, tax_rates: ["txr_manual_test"] }],
      automatic_tax: { enabled: false },
      name_collection: { business: { enabled: true, optional: false } },
      tax_id_collection: { enabled: false },
      subscription_data: { metadata: expect.objectContaining({ tax_decision: "oppe-workshop-tax-2026-10-07", customer_vat_regime: "FRANCHISE", professional_customer: "true" }) },
    }), expect.anything());
    expect(h.rpc).toHaveBeenCalledWith("marketplace_reserve_workshop_checkout", expect.objectContaining({ p_terms_version: WORKSHOP_SUBSCRIPTION_TERMS }));
    expect(h.customer).toHaveBeenCalledWith("cus_test", { invoice_settings: expect.objectContaining({ footer: expect.stringContaining("TVA FR55 943 317 610") }) });
  });
  it("ne transforme pas un accès historique sans accord explicite", async () => {
    await expect(createWorkshopCheckout(db(), "owner", false)).rejects.toThrow();
    expect(h.checkout).not.toHaveBeenCalled(); expect(h.rpc).not.toHaveBeenCalled();
  });
  it("ne facture pas 20 % à un établissement étranger", async () => {
    country = "BE";
    await expect(createWorkshopCheckout(db(), "owner", true)).rejects.toThrow("individuelle");
    expect(h.checkout).not.toHaveBeenCalled(); expect(h.rpc).not.toHaveBeenCalled();
  });
  it("refuse un taux inclus avant toute réservation", async () => {
    h.rate.mockResolvedValue({ active: true, percentage: 20, inclusive: true, country: "FR", tax_type: "vat" });
    await expect(createWorkshopCheckout(db(), "owner", true)).rejects.toThrow();
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it("refuse un prix différent des 15 euros HT approuvés", async () => {
    h.prices.mockResolvedValue({ data: [{ currency: "eur", unit_amount: 1800, tax_behavior: "exclusive", recurring: { interval: "month", interval_count: 1 } }] });
    await expect(createWorkshopCheckout(db(), "owner", true)).rejects.toThrow();
    expect(h.rpc).not.toHaveBeenCalled();
  });
});
