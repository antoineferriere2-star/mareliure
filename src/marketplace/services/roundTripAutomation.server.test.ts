import { afterEach, describe, expect, it, vi } from "vitest";

// Les verrous du chemin automatique, avant tout accès fournisseur ou réservation.
const h = vi.hoisted(() => ({ enabled: false, configured: false, rpc: vi.fn() }));
vi.mock("./caseLogistics.server", async (original) => ({
  ...(await original<typeof import("./caseLogistics.server")>()),
  automationState: async () => ({ enabled: h.enabled, providerConfigured: h.configured, evidence: {}, changedAt: null }),
}));
vi.mock("@/build/services/adminAuth.server", () => ({ admin: async () => ({ from: () => ({}), rpc: h.rpc }) }));

import { addressSha256, isPurchasableMethod, purchaseAutomatically } from "./roundTripAutomation.server";
import { LogisticsError } from "./caseLogistics.server";
import { handleRoundTripWebhookRequest } from "./roundTripWebhook.server";

const provider = { name: "sendcloud", create: vi.fn(), findByReference: vi.fn(), cancel: vi.fn() };
const sb = { rpc: h.rpc, from: () => { throw new Error("no read expected"); } } as never;
const code = (p: Promise<unknown>) => p.then(() => "ok", (e) => (e instanceof LogisticsError ? e.code : String(e)));

afterEach(() => { vi.unstubAllEnvs(); h.enabled = false; h.configured = false; });

describe("achat automatique fermé par défaut", () => {
  it("verrou fermé : aucune réservation, aucun appel fournisseur", async () => {
    expect(await code(purchaseAutomatically(sb, "case", "outbound", provider))).toBe("automation_closed");
    expect(h.rpc).not.toHaveBeenCalled();
    expect(provider.create).not.toHaveBeenCalled();
  });
  it("verrou ouvert mais clés absentes : indisponible, jamais un succès", async () => {
    h.enabled = true;
    expect(await code(purchaseAutomatically(sb, "case", "outbound", null))).toBe("provider_unavailable");
    h.configured = false;
    expect(await code(purchaseAutomatically(sb, "case", "outbound", provider))).toBe("provider_unavailable");
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it("webhook sans secret ni clés configurés : 404, rien n'est lu", async () => {
    vi.stubEnv("SENDCLOUD_WEBHOOK_SECRET", "");
    const response = await handleRoundTripWebhookRequest(new Request("https://x.test", { method: "POST", body: "{}" }));
    expect(response.status).toBe(404);
  });
});

describe("empreinte d'adresse", () => {
  it("stable à la casse et aux espaces près, différente pour une autre adresse", async () => {
    const a = { name: "QA Client", line1: "1 rue  de la Recette", line2: null, postalCode: "75011", city: "Paris", countryCode: "FR" };
    expect(await addressSha256(a)).toBe(await addressSha256({ ...a, name: " qa client ", line1: "1 RUE DE LA RECETTE" }));
    expect(await addressSha256(a)).not.toBe(await addressSha256({ ...a, postalCode: "75012" }));
    expect(await addressSha256(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("méthode retenue pour le tarif revu", () => {
  // Extrait du devis réel du 7 octobre 2026 (Paris 75011 → Lyon 69002, 500 g).
  const option = (code: string, priceCents: number | null, servicePointRequired: boolean, currency: string | null = "EUR") =>
    ({ code, name: code, carrier: "", firstMile: null, lastMile: null, returns: false, servicePointRequired, chargingType: null, priceCents, currency });
  const quote = [
    option("mondial_relay:service_point,dualapi/size=l,c2c", 391, true),
    option("mondial_relay:home_domestic,dualapi/c2c", 517, false),
    option("colissimo:home/fr", 885, false),
    option("chronopost:18", null, false),
    option("colissimo:home/signature,fr", 1005, false, "GBP"),
  ];
  it("accepte une méthode chiffrée en EUR sans point relais, espaces autour tolérés", () => {
    expect(isPurchasableMethod(quote, "mondial_relay:home_domestic,dualapi/c2c")).toBe(true);
    expect(isPurchasableMethod(quote, " colissimo:home/fr ")).toBe(true);
  });
  it("refuse un point relais, un prix absent, une autre devise ou un code hors devis", () => {
    expect(isPurchasableMethod(quote, "mondial_relay:service_point,dualapi/size=l,c2c")).toBe(false);
    expect(isPurchasableMethod(quote, "chronopost:18")).toBe(false);
    expect(isPurchasableMethod(quote, "colissimo:home/signature,fr")).toBe(false);
    expect(isPurchasableMethod(quote, "mondial_relay:home_domestic")).toBe(false);
    expect(isPurchasableMethod([], "colissimo:home/fr")).toBe(false);
  });
});
