import { afterEach, describe, expect, it, vi } from "vitest";

// Les verrous du chemin automatique, avant tout accès fournisseur ou réservation.
const h = vi.hoisted(() => ({ enabled: false, configured: false, rpc: vi.fn() }));
vi.mock("./caseLogistics.server", async (original) => ({
  ...(await original<typeof import("./caseLogistics.server")>()),
  automationState: async () => ({ enabled: h.enabled, providerConfigured: h.configured, evidence: {}, changedAt: null }),
}));
vi.mock("@/build/services/adminAuth.server", () => ({ admin: async () => ({ from: () => ({}), rpc: h.rpc }) }));

import { addressSha256, purchaseAutomatically } from "./roundTripAutomation.server";
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
