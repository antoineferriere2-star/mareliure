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

const { notifyAdmin, adminCaseUrl, sendAdminAlertTest } = await import("./adminAlerts.server");

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

  it("alerte de test : même modèle et même destinataire, clé unique, lien vers le pilotage", async () => {
    const outcome = await sendAdminAlertTest(new Date("2026-10-12T18:00:00Z"));
    expect(outcome).toEqual({ sent: true, reason: null });
    const [template, to, options] = sent.calls[0] as [string, string, { templateData: Record<string, string>; idempotencyKey: string }];
    expect(template).toBe("case-activity");
    expect(to).toBe("contact@oppe.fr");
    expect(options.templateData.heading).toBe("Test des alertes — Ma Reliure");
    expect(options.templateData.intro).toContain("12/10/2026");
    expect(options.templateData.ctaUrl).toBe("https://mareliure.fr/admin");
    expect(options.idempotencyKey).toBe(`admin-alert-test-${Date.parse("2026-10-12T18:00:00Z")}`);
  });

  it("alerte de test en échec : la raison remonte au pilotage, sans exception", async () => {
    sent.fail = true;
    await expect(sendAdminAlertTest()).resolves.toEqual({ sent: false, reason: "RESEND_API_KEY is not configured" });
  });
});
