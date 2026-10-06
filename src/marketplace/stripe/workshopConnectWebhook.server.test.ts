import { beforeEach, describe, it, expect, vi } from "vitest";
import { handleWorkshopConnectWebhook } from "./workshopConnectWebhook.server";
const h = vi.hoisted(() => ({
  construct: vi.fn(),
  claim: vi.fn(),
  processed: vi.fn(),
  failed: vi.fn(),
  process: vi.fn(),
  parse: vi.fn(),
  refresh: vi.fn(),
  guard: vi.fn(),
}));
vi.mock("@/build/services/adminAuth.server", () => ({ admin: async () => ({}) }));
vi.mock("./stripeClient.server", () => ({
  getMarketplaceStripeClient: () => ({
    webhooks: { constructEventAsync: h.construct },
    parseEventNotificationAsync: h.parse,
  }),
  assertExpectedStripeAccount: h.guard,
}));
vi.mock("@/marketplace/services/stripeWebhookLog.server", () => ({
  claimWebhookEvent: h.claim,
  markWebhookEventProcessed: h.processed,
  markWebhookEventFailed: h.failed,
}));
vi.mock("./workshopOnlinePayment.server", () => ({ processWorkshopConnectEvent: h.process }));
vi.mock("./binderConnect.server", () => ({ refreshWorkshopConnectAccountById: h.refresh }));
const request = (signature = true) =>
  new Request("https://qa.invalid/api/marketplace/connect-webhook", {
    method: "POST",
    headers: signature ? { "stripe-signature": "qa" } : {},
    body: "{}",
  });
beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET = "qa";
  delete process.env.STRIPE_CONNECT_V2_WEBHOOK_SECRET;
  h.construct.mockResolvedValue({
    id: "evt_qa",
    type: "payment_intent.succeeded",
    account: "acct_qa",
  });
  h.claim.mockResolvedValue({ outcome: "claimed" });
  h.process.mockResolvedValue(undefined);
});
describe("webhook Connect signé et rejouable", () => {
  it("refuse avant toute lecture une signature absente ou invalide", async () => {
    expect((await handleWorkshopConnectWebhook(request(false))).status).toBe(400);
    h.construct.mockRejectedValue(new Error("invalid"));
    expect((await handleWorkshopConnectWebhook(request())).status).toBe(400);
    expect(h.claim).not.toHaveBeenCalled();
  });
  it("accuse réception seulement après succès et absorbe le doublon traité", async () => {
    expect((await handleWorkshopConnectWebhook(request())).status).toBe(200);
    expect(h.processed).toHaveBeenCalled();
    h.claim.mockResolvedValue({ outcome: "already_processed" });
    await handleWorkshopConnectWebhook(request());
    expect(h.process).toHaveBeenCalledTimes(1);
  });
  it("répond non-2xx si le traitement échoue ou si un autre Worker traite déjà", async () => {
    h.process.mockRejectedValue(new Error("database"));
    expect((await handleWorkshopConnectWebhook(request())).status).toBe(500);
    expect(h.failed).toHaveBeenCalled();
    h.claim.mockResolvedValue({ outcome: "in_progress" });
    expect((await handleWorkshopConnectWebhook(request())).status).toBe(409);
  });
  it("vérifie la signature v2 et relit le compte sans traiter un paiement de la plateforme", async () => {
    process.env.STRIPE_CONNECT_V2_WEBHOOK_SECRET = "qa_v2";
    h.construct.mockRejectedValue(new Error("other_secret"));
    const fetched = vi.fn().mockResolvedValue({ id: "evt_v2", type: "v2.core.account.updated" });
    h.parse.mockResolvedValue({
      id: "evt_v2",
      type: "v2.core.account.updated",
      related_object: { id: "acct_seller", type: "v2.core.account" },
      fetchEvent: fetched,
    });
    expect((await handleWorkshopConnectWebhook(request())).status).toBe(200);
    expect(h.refresh).toHaveBeenCalledWith({}, "acct_seller");
    expect(h.process).not.toHaveBeenCalled();
    h.claim.mockResolvedValue({ outcome: "already_processed" });
    await handleWorkshopConnectWebhook(request());
    expect(fetched).toHaveBeenCalledTimes(1);
  });
});
