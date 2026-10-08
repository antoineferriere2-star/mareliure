import { beforeEach, describe, expect, it, vi } from "vitest";

const sent = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock("@/lib/email-templates/send-email", () => ({
  sendTemplateEmail: async (...args: unknown[]) => { sent.calls.push(args); return { sent: true }; },
}));
vi.mock("@/build/services/operationalLog.server", () => ({ logOperationalError: vi.fn() }));

const alerts = await import("./adminEventAlerts.server");

type Options = { templateData: Record<string, string>; idempotencyKey: string };
const last = () => { const [template, to, options] = sent.calls.at(-1) as [string, string, Options]; return { template, to, ...options }; };

/** Faux client : renvoie la ligne demandée, quel que soit le filtre. */
const db = (row: Record<string, unknown> | null, rows: Record<string, unknown>[] = row ? [row] : []) => ({
  from: () => {
    const builder = { select: () => builder, eq: () => builder, in: () => Promise.resolve({ data: rows, error: null }),
      maybeSingle: () => Promise.resolve({ data: row, error: null }) };
    return builder;
  },
}) as never;

beforeEach(() => { sent.calls = []; });

describe("alertes d'activité de l'équipe", () => {
  it("nouveau livre : référence et marque, lien admin du dossier, une clé par Dossier", async () => {
    await alerts.alertNewCase(db({ id: "case-1", reference: "RL-011", brand: "FINE_BINDERY", acquisition_origin: "OPPE" }), "dossier-1");
    const mail = last();
    expect(mail.to).toBe("contact@oppe.fr");
    expect(mail.templateData.heading).toBe("Nouveau livre confié — RL-011");
    expect(mail.templateData.intro).toContain("Fine Bindery");
    expect(mail.templateData.ctaUrl).toBe("https://mareliure.fr/admin/leads/case-1");
    expect(mail.idempotencyKey).toBe("new-case-dossier-1");
  });

  it("nouveau livre sans dossier rattaché : alerte quand même, même clé", async () => {
    await alerts.alertNewCase(db(null), "dossier-2");
    expect(last().templateData.ctaUrl).toBe("https://mareliure.fr/admin/leads");
    expect(last().idempotencyKey).toBe("new-case-dossier-2");
  });

  it("lien d'atelier : signalé comme client de l'atelier", async () => {
    await alerts.alertNewCase(db({ id: "c", reference: "RL-012", brand: "MA_RELIURE", acquisition_origin: "BINDER_REFERRED" }), "d");
    expect(last().templateData.intro).toContain("par le lien d'un atelier");
  });

  it("espace client : une alerte par dossier rattaché, aucune sans dossier", async () => {
    await alerts.alertCustomerSpaceOpened(db(null, []), []);
    expect(sent.calls).toHaveLength(0);
    await alerts.alertCustomerSpaceOpened(db(null, [{ id: "a", reference: "RL-1", brand: "MA_RELIURE" }, { id: "b", reference: "RL-2", brand: "MA_RELIURE" }]), ["a", "b"]);
    expect(sent.calls.map((call) => (call[2] as Options).idempotencyKey)).toEqual(["customer-space-a", "customer-space-b"]);
  });

  it("messages : seulement ceux adressés à l'équipe, jamais le texte du message", async () => {
    const sb = db({ reference: "RL-3", acquisition_origin: "OPPE" });
    const ownClient = db({ reference: "RL-4", acquisition_origin: "BINDER_REFERRED" });
    expect(await alerts.alertTeamMessage(sb, "c", "m0", "admin", "customer_concierge")).toBe(false);
    expect(await alerts.alertTeamMessage(sb, "c", "m2", "binder", "shared")).toBe(false);
    expect(await alerts.alertTeamMessage(ownClient, "c", "m5", "customer", "shared")).toBe(false);
    expect(sent.calls).toHaveLength(0);
    // Fil partagé Ma Reliure : OPPE vend, le message du client la concerne.
    await alerts.alertTeamMessage(sb, "c", "m1", "customer", "shared");
    expect(last().idempotencyKey).toBe("team-message-m1");
    expect(JSON.stringify(last().templateData)).not.toContain("Bonjour");
    await alerts.alertTeamMessage(sb, "c", "m3", "customer", "customer_concierge");
    expect(last().templateData.heading).toBe("Nouveau message du client — RL-3");
    expect(last().idempotencyKey).toBe("team-message-m3");
    await alerts.alertTeamMessage(sb, "c", "m4", "binder", "workshop_platform");
    expect(last().templateData.heading).toBe("Nouveau message de l'atelier — RL-3");
  });

  it("atelier : inscription et invitation, lien vers la fiche atelier", async () => {
    await alerts.alertWorkshopJoined("b1", "Atelier Test", "self_registration");
    expect(last().templateData).toMatchObject({ heading: "Nouvel atelier inscrit — Atelier Test", ctaUrl: "https://mareliure.fr/admin/ateliers/b1" });
    await alerts.alertWorkshopJoined("b1", "Atelier Test", "invitation");
    expect(last().idempotencyKey).toBe("workshop-joined-invitation-b1");
  });

  it("paiement en ligne : seulement au passage d'inactif à actif", async () => {
    expect(await alerts.alertWorkshopPaymentsActivated("b", "A", true, true)).toBe(false);
    expect(await alerts.alertWorkshopPaymentsActivated("b", "A", false, false)).toBe(false);
    expect(await alerts.alertWorkshopPaymentsActivated("b", "A", true, false)).toBe(false);
    expect(sent.calls).toHaveLength(0);
    await alerts.alertWorkshopPaymentsActivated("b", "A", false, true);
    expect(last().idempotencyKey).toBe("workshop-connect-active-b");
  });

  it("abonnement : souscription, impayé, résiliation, rien pour un renouvellement", async () => {
    const change = (previous: string | null, next: string) =>
      alerts.alertWorkshopSubscriptionChange({ binderId: "b", workshopName: "A", subscriptionId: "sub_1", previous, next });
    expect(await change("active", "active")).toBe(false);
    expect(await change(null, "incomplete")).toBe(false);
    expect(sent.calls).toHaveLength(0);
    await change("incomplete", "active");
    expect(last().templateData.heading).toBe("Abonnement souscrit — A");
    await change("active", "past_due");
    expect(last().templateData.heading).toBe("Abonnement impayé — A");
    await change("past_due", "canceled");
    expect(last().idempotencyKey).toBe("workshop-subscription-sub_1-canceled");
  });
});
