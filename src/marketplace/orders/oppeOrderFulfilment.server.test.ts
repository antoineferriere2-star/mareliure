import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Supa } from "@/build/services/adminAuth.server";

const transport = vi.hoisted(() => ({ send: vi.fn(), alert: vi.fn(), log: vi.fn(), stripe: vi.fn() }));
vi.mock("@/lib/email-templates/send-email", () => ({ sendTemplateEmail: transport.send }));
vi.mock("@/marketplace/notifications/adminAlerts.server", () => ({ caseReference: async () => ({ reference: "TEST-A" }), notifyAdmin: transport.alert }));
vi.mock("@/build/services/operationalLog.server", () => ({ logOperationalError: transport.log }));
vi.mock("@/marketplace/stripe/stripeClient.server", () => ({ getMarketplaceStripeClient: () => ({ paymentIntents: { retrieve: transport.stripe } }) }));
vi.mock("@/marketplace/services/commercialProposalRepository.server", () => ({ loadCommercialProposalById: async () => ({ billingCountry: "FR", taxCountry: "FR", customerType: "CUSTOMER", businessName: null, workshopServiceDescription: "PRESTATION FICTIVE", workshopLeadTimeDays: 21 }) }));

const { onOppePaymentConfirmed } = await import("./oppeOrderFulfilment.server");
const input = { caseId: "case-test", proposalId: "proposal-test", paymentIntentId: "pi_test", paidAt: "2026-10-06T12:00:00Z" };

function database(brand: "MA_RELIURE" | "FINE_BINDERY") {
  const state = { orders: new Set<string>(), invoices: new Set<string>(), sentAt: null as string | null };
  const sb = {
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "order-recipe@example.com" } } }) } },
    rpc: async (name: string) => {
      if (name === "marketplace_open_oppe_order") {
        const opened = !state.orders.size; state.orders.add(input.proposalId); return { data: opened, error: null };
      }
      if (name === "marketplace_issue_oppe_invoice") {
        state.invoices.add(input.proposalId); return { data: "invoice-test", error: null };
      }
      throw Error(`Unexpected RPC ${name}`);
    },
    from: (table: string) => {
      let update: Record<string, unknown> | undefined;
      const q = {
        select: () => q,
        eq: () => q,
        update: (value: Record<string, unknown>) => { update = value; return q; },
        is: async () => { state.sentAt = String(update?.confirmation_sent_at); return { error: null }; },
        maybeSingle: async () => ({ data: null, error: null }),
        single: async () => ({ error: null, data: table === "marketplace_oppe_orders"
          ? { brand, confirmation_sent_at: state.sentAt }
          : table === "marketplace_oppe_invoices" ? { number: "TEST-2026-1", total_ttc_cents: 21100 }
          : { brand, reference: "TEST-A", customer_user_id: "customer-test", dossier_id: null } }),
      };
      return q;
    },
  } as unknown as Supa;
  return { sb, state };
}

beforeEach(() => {
  vi.clearAllMocks();
  transport.send.mockReset().mockResolvedValue({ sent: true });
  transport.alert.mockResolvedValue(undefined);
  transport.stripe.mockReset().mockResolvedValue({ latest_charge: null });
});

describe("confirmation de commande A reprise après erreur", () => {
  it.each(["MA_RELIURE", "FINE_BINDERY"] as const)("%s : panne e-mail, reprise puis doublon conservent une seule commande et facture", async brand => {
    const { sb, state } = database(brand);
    transport.send.mockRejectedValueOnce(new Error("mail provider unavailable"));
    await expect(onOppePaymentConfirmed(sb, input)).rejects.toThrow("mail provider unavailable");
    expect(state.orders.size).toBe(1);
    expect(state.invoices.size).toBe(1);
    expect(state.sentAt).toBeNull();
    expect(transport.alert).toHaveBeenCalledOnce();
    await expect(onOppePaymentConfirmed(sb, input)).resolves.toEqual({ orderOpened: false, invoiceId: "invoice-test" });
    expect(state.sentAt).not.toBeNull();
    await onOppePaymentConfirmed(sb, input);
    expect(state.orders.size).toBe(1);
    expect(state.invoices.size).toBe(1);
    expect(transport.send).toHaveBeenCalledTimes(2);
    for (const [, , options] of transport.send.mock.calls) {
      expect(options).toMatchObject({ brand, idempotencyKey: "order-confirmed-proposal-test" });
      expect(options.templateData.ctaUrl).toContain(brand === "FINE_BINDERY" ? "finebindery.com" : "mareliure.fr");
    }
  });

  it("une panne de l'alerte administrative ne masque pas la confirmation à reprendre", async () => {
    const { sb, state } = database("MA_RELIURE");
    transport.send.mockRejectedValueOnce(new Error("mail provider unavailable"));
    transport.alert.mockRejectedValueOnce(new Error("admin provider unavailable"));
    await expect(onOppePaymentConfirmed(sb, input)).rejects.toThrow("mail provider unavailable");
    expect(state.sentAt).toBeNull();
    expect(transport.log).toHaveBeenCalledWith("oppe-order.confirmation-alert-failed", expect.any(Error), { caseId: input.caseId });
  });

  it("le relevé des frais temporairement indisponible conserve facture et confirmation", async () => {
    const { sb, state } = database("MA_RELIURE");
    transport.stripe.mockRejectedValueOnce(new Error("balance transaction not ready"));
    await expect(onOppePaymentConfirmed(sb, input)).resolves.toMatchObject({ invoiceId: "invoice-test" });
    expect(state.invoices.size).toBe(1);
    expect(state.sentAt).not.toBeNull();
  });
});
