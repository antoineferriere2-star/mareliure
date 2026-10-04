import { beforeEach, describe, expect, it, vi } from "vitest";

const sent = vi.hoisted(() => ({ calls: [] as unknown[][], fail: false }));
vi.mock("@/lib/email-templates/send-email", () => ({
  sendTemplateEmail: async (...args: unknown[]) => {
    sent.calls.push(args);
    if (sent.fail) throw new Error("RESEND_API_KEY is not configured");
    return { sent: true };
  },
}));
vi.mock("@/build/services/operationalLog.server", () => ({ logOperationalError: vi.fn() }));

const { notifyAdmin, adminCaseUrl } = await import("./adminAlerts.server");

beforeEach(() => {
  sent.calls = [];
  sent.fail = false;
});

describe("les alertes de l'équipe", () => {
  it("partent à l'adresse de contact, avec le lien du dossier et leur clé d'idempotence", async () => {
    await expect(notifyAdmin({ caseId: "c-1", heading: "Paiement reçu — RL-1", intro: "…", idempotencyKey: "payment-received-pi_1" })).resolves.toBe(true);
    const [template, to, options] = sent.calls[0] as [string, string, { templateData: Record<string, unknown>; idempotencyKey: string }];
    expect(template).toBe("case-activity");
    expect(to).toBe("contact@oppe.fr");
    expect(options.templateData.ctaUrl).toBe(adminCaseUrl("c-1"));
    expect(options.idempotencyKey).toBe("payment-received-pi_1");
  });

  it("ne bloquent jamais l'action qui les déclenche : un échec rend false, sans exception", async () => {
    sent.fail = true;
    await expect(notifyAdmin({ caseId: "c-1", heading: "x", intro: "y", idempotencyKey: "k" })).resolves.toBe(false);
  });
});
