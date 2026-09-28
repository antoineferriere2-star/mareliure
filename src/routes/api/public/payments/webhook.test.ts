import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ verify: vi.fn(), update: vi.fn(), eq: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock("@/lib/stripe.server", () => ({
  createStripeClient: () => ({ webhooks: { constructEventAsync: h.verify } }),
  getWebhookSecret: () => "test-secret", parseStripeEnv: () => "sandbox",
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => ({ update: h.update }) } }));
vi.mock("@/build/services/operationalLog.server", () => ({ logOperationalError: vi.fn() }));
import { Route } from "./webhook";

const post = (Route as unknown as { server: { handlers: { POST: (input: { request: Request }) => Promise<Response> } } }).server.handlers.POST;
const request = () => new Request("https://qa.invalid/api/public/payments/webhook?env=sandbox", { method: "POST", headers: { "stripe-signature": "test" }, body: "test" });

beforeEach(() => {
  vi.clearAllMocks();
  h.update.mockReturnValue({ eq: h.eq });
  h.eq.mockResolvedValue({ error: null });
});

describe("subscription webhook persistence", () => {
  it.each(["checkout.session.completed", "customer.subscription.updated", "customer.subscription.deleted"])("%s remains retryable on database failure", async type => {
    h.verify.mockResolvedValue({ type, data: { object: { id: "sub_qa", metadata: { workspace_id: "workspace-qa" }, customer: "cus_qa", status: "canceled", items: { data: [] } } } });
    h.eq.mockResolvedValueOnce({ error: new Error("database unavailable") });
    // Let the route framework return 500, never acknowledge a lost subscription update.
    await expect(post({ request: request() })).rejects.toThrow("database unavailable");
    expect((await post({ request: request() })).status).toBe(200);
  });
});
