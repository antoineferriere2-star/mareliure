import { beforeEach, expect, it, vi } from "vitest";
import { notifyWorkshop } from "./workshopNotices.server";
import type { Supa } from "@/build/services/adminAuth.server";

const h = vi.hoisted(() => ({ send: vi.fn(), guard: vi.fn() }));
vi.mock("@/lib/email-templates/send-email", () => ({ sendTemplateEmail: h.send }));
vi.mock("@/marketplace/stripe/stripeClient.server", () => ({ assertExpectedStripeAccount: h.guard }));
const notice = { id: "invoice-paid-fixture", binderId: "workshop-fixture", heading: "Facture payée", intro: "Le règlement est enregistré." };
function fixture(claim: string | null = "lease", terminal = false) {
  const writes: Array<Record<string, unknown>> = [];
  const owner = vi.fn().mockResolvedValue({ data: { user: { email: "owner@example.com" } } });
  const chain = (data: unknown) => {
    const result = { data, error: null };
    const q = { eq: vi.fn(() => q), single: vi.fn(async () => result), then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
    return q;
  };
  const sb = {
    rpc: vi.fn().mockResolvedValue({ data: claim, error: null }),
    auth: { admin: { getUserById: owner } },
    from: vi.fn((table: string) => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn(() => chain(table === "marketplace_binders" ? { user_id: "owner" } : { sent_at: terminal ? "2026-10-06" : null, captured_at: null })),
      update: vi.fn((value: Record<string, unknown>) => { writes.push(value); return chain(null); }),
    })),
  };
  return { sb: sb as unknown as Supa, writes, owner };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("WORKSHOP_NOTICE_TEST_CAPTURE", "false");
  h.send.mockResolvedValue({ sent: true });
});
it("ne renvoie pas le courrier d'un événement déjà livré", async () => {
  const f = fixture(null, true);
  await notifyWorkshop(f.sb, notice);
  expect(h.send).not.toHaveBeenCalled();
  expect(f.writes).toEqual([]);
});
it("fait rejouer le webhook lorsqu'une autre livraison détient le bail", async () => {
  const f = fixture(null);
  await expect(notifyWorkshop(f.sb, notice)).rejects.toThrow("workshop_notice_in_progress");
  expect(h.send).not.toHaveBeenCalled();
});
it("réutilise la clé fournisseur et ne marque livré qu'après succès", async () => {
  const f = fixture();
  await notifyWorkshop(f.sb, notice);
  expect(h.send).toHaveBeenCalledWith("case-activity", "owner@example.com", expect.objectContaining({ idempotencyKey: "workshop-invoice-paid-fixture" }));
  expect(f.writes).toEqual([expect.objectContaining({ sent_at: expect.any(String), claim_token: null })]);
});
it("adresse la notification C avec la marque Fine Bindery de la facture de frais", async () => {
  const f = fixture();
  await notifyWorkshop(f.sb, { ...notice, brand: "FINE_BINDERY" });
  expect(h.send).toHaveBeenCalledWith("case-activity", "owner@example.com", expect.objectContaining({
    brand: "FINE_BINDERY", templateData: expect.objectContaining({ brandName: "Fine Bindery" }),
  }));
});
it("libère le bail après un échec et permet une reprise avec la même clé", async () => {
  const f = fixture();
  h.send.mockResolvedValueOnce({ sent: false });
  await expect(notifyWorkshop(f.sb, notice)).rejects.toThrow("workshop_notice_not_delivered");
  expect(f.writes).toEqual([{ processing_until: null, claim_token: null }]);
  await notifyWorkshop(f.sb, notice);
  expect(h.send).toHaveBeenCalledTimes(2);
  expect(h.send.mock.calls[0][2].idempotencyKey).toBe(h.send.mock.calls[1][2].idempotencyKey);
});
it("interdit une capture de recette en dehors du compte et de la base isolés", async () => {
  const f = fixture();
  vi.stubEnv("WORKSHOP_NOTICE_TEST_CAPTURE", "true");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_fixture_not_a_key");
  await expect(notifyWorkshop(f.sb, notice)).rejects.toThrow("workshop_notice_capture_requires_isolated_test_environment");
  expect(h.send).not.toHaveBeenCalled();
  expect(h.guard).not.toHaveBeenCalled();
  expect(f.writes).toEqual([{ processing_until: null, claim_token: null }]);
});
