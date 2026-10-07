import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureBinderStripeAccount,
  readWorkshopConnectAccount,
  refreshBinderConnectStatus,
} from "./binderConnect.server";
const h = vi.hoisted(() => ({
  guard: vi.fn(),
  retrieve: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  list: vi.fn(),
}));
vi.mock("./stripeClient.server", () => ({
  assertExpectedStripeAccount: h.guard,
  getMarketplaceStripeClient: () => ({
    v2: {
      core: {
        accounts: { retrieve: h.retrieve, create: h.create, update: h.update, list: h.list },
      },
    },
  }),
}));
let account: Record<string, unknown>;
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.clearAllMocks();
  account = {
    id: "acct_seller",
    dashboard: "full",
    closed: false,
    defaults: {
      responsibilities: {
        fees_collector: "stripe",
        losses_collector: "stripe",
        requirements_collector: "stripe",
      },
    },
    configuration: {
      merchant: {
        capabilities: {
          card_payments: { status: "active" },
          stripe_balance: { payouts: { status: "active" } },
        },
      },
    },
    requirements: {
      entries: [
        { awaiting_action_from: "user", description: "business_details" },
        { awaiting_action_from: "stripe", description: "pending_review" },
      ],
    },
  };
  h.retrieve.mockImplementation(async () => account);
});

describe("fixture complémentaire hébergée strictement isolée", () => {
  beforeEach(() => {
    vi.stubEnv("WORKSHOP_CONNECT_TEST_ACCOUNT_ID", "acct_recipe");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture");
    vi.stubEnv("STRIPE_EXPECTED_ACCOUNT_ID", "acct_1UGISJKB3EBc6Slh");
    vi.stubEnv("SUPABASE_URL", "https://qwfhebtxeubfmvvdsqdt.supabase.co");
    account.id = "acct_recipe";
    account.livemode = false;
    account.dashboard = "express";
    account.metadata = { qa_recipe: "oppe-c-official-fixtures-20261007" };
  });
  it("garde les capacités actives et Stripe responsable des frais et pertes", async () => {
    expect((await readWorkshopConnectAccount("acct_recipe")).onboarded).toBe(true);
  });
  it.each([
    ["STRIPE_SECRET_KEY", "sk_live_fixture"],
    ["STRIPE_EXPECTED_ACCOUNT_ID", "acct_live"],
    ["SUPABASE_URL", "https://hljxohondjvrkzqicexl.supabase.co"],
    ["WORKSHOP_CONNECT_TEST_ACCOUNT_ID", "acct_other"],
  ])("refuse l'environnement incompatible %s", async (key, value) => {
    vi.stubEnv(key, value);
    expect((await readWorkshopConnectAccount("acct_recipe")).onboarded).toBe(false);
  });
  it("refuse une fixture live, un compte non marqué et une capacité inactive", async () => {
    account.livemode = true;
    expect((await readWorkshopConnectAccount("acct_recipe")).onboarded).toBe(false);
    account.livemode = false;
    account.metadata = {};
    expect((await readWorkshopConnectAccount("acct_recipe")).onboarded).toBe(false);
    account.metadata = { qa_recipe: "oppe-c-official-fixtures-20261007" };
    account.configuration = { merchant: { capabilities: {
      card_payments: { status: "restricted" }, stripe_balance: { payouts: { status: "active" } },
    } } };
    expect((await readWorkshopConnectAccount("acct_recipe")).onboarded).toBe(false);
  });
});
describe("atelier vendeur Accounts v2", () => {
  it("autorise seulement les capacités actives et les responsabilités contractuelles", async () => {
    expect(await readWorkshopConnectAccount("acct_seller")).toMatchObject({
      onboarded: true,
      chargesEnabled: true,
      payoutsEnabled: true,
      requirements: ["business_details"],
    });
    expect(h.guard).toHaveBeenCalledOnce();
    expect(h.retrieve).toHaveBeenCalledWith("acct_seller", {
      include: ["configuration.merchant", "defaults", "requirements"],
    });
  });
  it.each(["pending", "restricted", "unsupported", "rejected"])(
    "refuse une capacité de paiement %s",
    async (status) => {
      account.configuration = {
        merchant: {
          capabilities: {
            card_payments: { status },
            stripe_balance: { payouts: { status: "active" } },
          },
        },
      };
      expect((await readWorkshopConnectAccount("acct_seller")).onboarded).toBe(false);
    },
  );
  it("refuse les virements indisponibles et le compte fermé", async () => {
    account.configuration = { merchant: { capabilities: { card_payments: { status: "active" } } } };
    expect((await readWorkshopConnectAccount("acct_seller")).onboarded).toBe(false);
    account.closed = true;
    expect((await readWorkshopConnectAccount("acct_seller")).configurationCompatible).toBe(false);
  });
  it.each(["fees_collector", "losses_collector", "requirements_collector"])(
    "refuse %s à la charge de la plateforme",
    async (key) => {
      (account.defaults as { responsibilities: Record<string, string> }).responsibilities[key] =
        "application";
      expect((await readWorkshopConnectAccount("acct_seller")).onboarded).toBe(false);
    },
  );
  it("conserve le compte déjà rattaché sans recommencer sa création", async () => {
    const q = {
      select: () => q,
      eq: () => q,
      maybeSingle: async () => ({ data: { stripe_account_id: "acct_existing" }, error: null }),
    };
    expect(await ensureBinderStripeAccount({ from: () => q } as never, "binder_1")).toBe(
      "acct_existing",
    );
    expect(h.create).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
  });
  it("retire l’état prêt en cache si Stripe restreint ultérieurement le compte", async () => {
    account.configuration = {
      merchant: { capabilities: { card_payments: { status: "restricted" } } },
    };
    const update = vi.fn();
    const q = {
      select: () => q,
      eq: () => q,
      maybeSingle: async () => ({
        data: { id: "b", stripe_account_id: "acct_seller" },
        error: null,
      }),
      update: (patch: unknown) => {
        update(patch);
        return { eq: async () => ({ error: null }) };
      },
    };
    expect((await refreshBinderConnectStatus({ from: () => q } as never, "b")).onboarded).toBe(
      false,
    );
    expect(update).toHaveBeenCalledWith({
      stripe_connect_charges_enabled: false,
      stripe_connect_payouts_enabled: false,
      stripe_connect_onboarded_at: null,
    });
  });
  it("réutilise le compte d’abonnement sans modifier l’identité soumise à la collecte Stripe", async () => {
    let stored: string | null = null;
    h.update.mockResolvedValue({ id: "acct_billing" });
    const sb = {
      from: (table: string) => {
        const q = {
          select: () => q,
          eq: () => q,
          maybeSingle: async () => ({
            data:
              table === "marketplace_binder_subscriptions"
                ? { stripe_customer_id: "acct_billing" }
                : {
                    id: "binder",
                    stripe_account_id: null,
                    country_code: "FR",
                    workshop_name: "Atelier",
                  },
            error: null,
          }),
          single: async () => ({ data: { stripe_account_id: stored }, error: null }),
          update: (patch: { stripe_account_id: string }) => {
            stored = patch.stripe_account_id;
            return q;
          },
          is: async () => ({ error: null }),
        };
        return q;
      },
    };
    expect(await ensureBinderStripeAccount(sb as never, "binder")).toBe("acct_billing");
    expect(h.create).not.toHaveBeenCalled();
    const params = h.update.mock.calls[0][1];
    expect(params.configuration.merchant.capabilities.card_payments.requested).toBe(true);
    expect(params).not.toHaveProperty("contact_email");
    expect(params).not.toHaveProperty("identity");
    expect(params).not.toHaveProperty("display_name");
  });
});
