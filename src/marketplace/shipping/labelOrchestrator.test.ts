import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// PostgreSQL réel (PGlite) : chaque test recrée la base ; la CI parallèle dépasse les 5 s par défaut.
vi.setConfig({ testTimeout: 30_000 });
import { adoptLeg, cancelLeg, declareLegAbsent, isUnusableProviderStatus, purchaseLeg, type LabelJobStore, type TransitionKind } from "./labelOrchestrator";
import type { CancelOutcome, CreateOutcome, LabelProvider, LabelRequest, ProviderLabel } from "./labelProvider";
import { handleSendcloudWebhook, verifySendcloudSignature } from "./sendcloudWebhook";
import { putLabelObject, reserveLeg, roundTripDb, RT } from "./roundTripTestDb.fixture";

// L'orchestrateur sur la VRAIE machine d'états SQL ; fournisseur simulé qui compte les étiquettes
// réellement créées. Aucun appel réseau, aucune étiquette achetée.
const PDF = new TextEncoder().encode("%PDF-1.4 QA label");
const request = async (): Promise<LabelRequest> => ({
  reference: "", direction: "outbound", shippingOptionCode: "qa:option",
  from: { name: "QA expéditeur", addressLine1: "1 rue QA", postalCode: "75001", city: "Paris", countryCode: "FR" },
  to: { name: "QA destinataire", addressLine1: "2 rue QA", postalCode: "69001", city: "Lyon", countryCode: "FR" },
  parcel: { weightGrams: 500, dimensionsMm: [350, 250, 80] },
});

class FakeProvider implements LabelProvider {
  name = "sendcloud";
  labels = new Map<string, ProviderLabel>();
  createCalls = 0;
  script: ("create" | "lose_response" | "reject" | "timeout_nothing" | "rate_limited")[] = [];
  findUnknown = false;
  pdfBytes = PDF;
  cancelOutcome: CancelOutcome = { kind: "cancelled", reference: "qa-cancel" };
  status = { code: "announced", message: "Announced" };
  private make(reference: string): ProviderLabel {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const provider = this;
    return { provider: "sendcloud", labelId: `parcel-${reference.slice(-4)}`, carrier: "qa_carrier", tracking: `QA${reference.slice(-6)}`,
      chargedTtcCents: 400, pdf: async () => this.pdfBytes, get status() { return provider.status; } };
  }
  async create(req: LabelRequest): Promise<CreateOutcome> {
    this.createCalls += 1;
    const step = this.script.shift() ?? "create";
    if (step === "reject") return { kind: "rejected", code: "http_400" };
    if (step === "rate_limited") return { kind: "not_created", code: "http_429" };
    if (step === "timeout_nothing") return { kind: "ambiguous", code: "network_or_timeout" };
    // Idempotence fournisseur : même référence ⇒ même étiquette (409 Sendcloud).
    const label = this.labels.get(req.reference) ?? this.make(req.reference);
    this.labels.set(req.reference, label);
    return step === "lose_response" ? { kind: "ambiguous", code: "network_or_timeout" } : { kind: "created", label };
  }
  async findByReference(reference: string) { return this.findUnknown ? "unknown" as const : this.labels.get(reference) ?? null; }
  async cancel() { return this.cancelOutcome; }
}

let db: PGlite;
let saved: Map<string, Uint8Array>;
let failStorage: boolean;
const store = (): LabelJobStore => ({
  async job(id) { return (await db.query<{ id: string; status: never }>("SELECT id,status FROM marketplace_round_trip_label_jobs WHERE id=$1", [id])).rows[0] ?? null; },
  async transition(id, kind: TransitionKind, details, providerEventId = null) {
    return (await db.query<{ r: never }>("SELECT marketplace_round_trip_label_transition($1,$2,$3,$4::jsonb) r", [id, kind, providerEventId, JSON.stringify(details)])).rows[0].r;
  },
  async savePrivateLabel(id, pdf) {
    if (failStorage) throw new Error("storage_unavailable");
    const existing = saved.get(`${id}/label.pdf`);
    if (existing && Buffer.compare(Buffer.from(existing), Buffer.from(pdf)) !== 0) throw new Error("label_object_conflict");
    if (!existing) await putLabelObject(db, id);
    saved.set(`${id}/label.pdf`, pdf);
  },
});
const events = async (job: string) => (await db.query<{ kind: string }>("SELECT kind FROM marketplace_round_trip_label_events WHERE job_id=$1 ORDER BY created_at", [job])).rows.map((r) => r.kind);
const status = async (job: string) => (await store().job(job))!.status as string;

beforeEach(async () => { db = await roundTripDb(); saved = new Map(); failStorage = false; }, 30000);
afterEach(async () => { await db.close(); });

describe("achat d'une étiquette", () => {
  it("confirme une étiquette, la stocke en privé et ne rachète jamais", async () => {
    const provider = new FakeProvider(); const job = await reserveLeg(db, "outbound");
    expect(await purchaseLeg(provider, store(), job, request)).toEqual({ state: "confirmed", costReviewRequired: false });
    expect(saved.has(`${job}/label.pdf`)).toBe(true);
    expect(await purchaseLeg(provider, store(), job, request)).toMatchObject({ state: "confirmed" });
    expect(provider.createCalls).toBe(1);
    expect(await events(job)).toEqual(["request_started", "label_confirmed"]);
  });
  it("après une réponse perdue, retrouve l'étiquette existante sans second achat", async () => {
    const provider = new FakeProvider(); provider.script = ["lose_response"];
    const job = await reserveLeg(db, "outbound");
    expect(await purchaseLeg(provider, store(), job, request)).toEqual({ state: "pending", code: "network_or_timeout" });
    expect(await status(job)).toBe("ambiguous");
    expect(await purchaseLeg(provider, store(), job, request)).toMatchObject({ state: "confirmed" });
    expect(provider.createCalls).toBe(1);
    expect(provider.labels.size).toBe(1);
  });
  it("si le fournisseur confirme l'absence, redemande avec la même référence (idempotente)", async () => {
    const provider = new FakeProvider(); provider.script = ["timeout_nothing"];
    const job = await reserveLeg(db, "outbound");
    await purchaseLeg(provider, store(), job, request);
    expect(await purchaseLeg(provider, store(), job, request)).toMatchObject({ state: "confirmed" });
    expect(provider.labels.size).toBe(1);
  });
  it("ne redemande rien tant que le fournisseur est illisible", async () => {
    const provider = new FakeProvider(); provider.script = ["lose_response"];
    const job = await reserveLeg(db, "outbound");
    await purchaseLeg(provider, store(), job, request);
    provider.findUnknown = true;
    expect(await purchaseLeg(provider, store(), job, request)).toEqual({ state: "pending", code: "provider_unreadable" });
    expect(provider.createCalls).toBe(1);
  });
  it("reprend une tentative interrompue avant toute réponse comme ambiguë", async () => {
    const provider = new FakeProvider(); const job = await reserveLeg(db, "outbound");
    // Le processus s'est arrêté juste après l'appel : étiquette créée, aucune issue enregistrée.
    await store().transition(job, "request_started", { provider: "sendcloud" });
    await provider.create({ ...(await request()), reference: job });
    expect(await purchaseLeg(provider, store(), job, request)).toMatchObject({ state: "confirmed" });
    expect(provider.createCalls).toBe(1);
  });
  it("un refus de validation au premier appel clôt le sens ; aucune reprise automatique ensuite", async () => {
    const provider = new FakeProvider(); provider.script = ["reject"];
    const job = await reserveLeg(db, "outbound");
    expect(await purchaseLeg(provider, store(), job, request)).toEqual({ state: "failed", code: "http_400" });
    expect(await purchaseLeg(provider, store(), job, request)).toEqual({ state: "review_required", code: "job_failed" });
    expect(provider.createCalls).toBe(1);
  });
  it("une limite de débit laisse la réservation reprenable sans la clore", async () => {
    const provider = new FakeProvider(); provider.script = ["rate_limited"];
    const job = await reserveLeg(db, "outbound");
    expect(await purchaseLeg(provider, store(), job, request)).toEqual({ state: "pending", code: "http_429" });
    expect(await purchaseLeg(provider, store(), job, request)).toMatchObject({ state: "confirmed" });
    expect(provider.labels.size).toBe(1);
  });
  it("une étiquette créée mais non stockée reste en reprise, puis est stockée sans second achat", async () => {
    const provider = new FakeProvider(); const job = await reserveLeg(db, "outbound");
    failStorage = true;
    expect(await purchaseLeg(provider, store(), job, request)).toEqual({ state: "pending", code: "label_storage" });
    failStorage = false;
    expect(await purchaseLeg(provider, store(), job, request)).toMatchObject({ state: "confirmed" });
    expect(provider.createCalls).toBe(1);
  });
  it("refuse un document qui n'est pas un PDF", async () => {
    const provider = new FakeProvider(); provider.pdfBytes = new TextEncoder().encode("<html>");
    const job = await reserveLeg(db, "outbound");
    expect(await purchaseLeg(provider, store(), job, request)).toEqual({ state: "pending", code: "label_storage" });
    expect(saved.size).toBe(0);
  });
  it("signale un coût facturé au-delà du tarif revu sans le masquer", async () => {
    const provider = new FakeProvider();
    provider.create = async (req) => { provider.createCalls += 1; const label = { provider: "sendcloud", labelId: "p-cost", carrier: "c", tracking: "T1", chargedTtcCents: 480, status: null, pdf: async () => PDF }; provider.labels.set(req.reference, label); return { kind: "created", label }; };
    const job = await reserveLeg(db, "outbound");
    expect(await purchaseLeg(provider, store(), job, request)).toEqual({ state: "confirmed", costReviewRequired: true });
  });
});

describe("annulation", () => {
  it.each([
    [{ kind: "cancelled", reference: "qa-cancel" } as CancelOutcome, "cancelled", "cancelled"],
    [{ kind: "queued", reference: "qa-cancel" } as CancelOutcome, "queued", "confirmed"],
    [{ kind: "refused", code: "http_409" } as CancelOutcome, "refused", "confirmed"],
    [{ kind: "ambiguous", code: "network_or_timeout" } as CancelOutcome, "pending", "confirmed"],
  ])("%o ⇒ %s, statut %s, jamais de remboursement présumé", async (outcome, expected, finalStatus) => {
    const provider = new FakeProvider(); provider.cancelOutcome = outcome;
    const job = await reserveLeg(db, "outbound");
    await purchaseLeg(provider, store(), job, request);
    expect((await cancelLeg(provider, store(), job)).state).toBe(expected);
    expect(await status(job)).toBe(finalStatus);
    expect((await db.query<{ r: number | null }>("SELECT refunded_cost_ttc_cents r FROM marketplace_round_trip_label_jobs WHERE id=$1", [job])).rows[0].r).toBeNull();
  });
  it("n'annule pas une étiquette non confirmée", async () => {
    const job = await reserveLeg(db, "outbound");
    expect(await cancelLeg(new FakeProvider(), store(), job)).toEqual({ state: "review_required", code: "job_claimed" });
  });
});

describe("webhook Sendcloud", () => {
  const secret = "qa-webhook-secret";
  const sign = async (body: string) => {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  };
  const deliver = async (provider: FakeProvider, body: string, signature?: string) =>
    handleSendcloudWebhook(new Request("https://qa.invalid/webhook", { method: "POST", body, headers: { "Sendcloud-Signature": signature ?? await sign(body) } }), {
      secret, provider, store: store(),
      jobByProviderLabel: async (labelId) => (await db.query<{ id: string }>("SELECT id FROM marketplace_round_trip_label_jobs WHERE provider_label_id=$1", [labelId])).rows[0] ?? null,
    });
  it("vérifie la signature HMAC en temps constant", async () => {
    const body = JSON.stringify({ action: "parcel_status_changed", timestamp: 1, parcel: { id: 1 } });
    expect(await verifySendcloudSignature(body, await sign(body), secret)).toBe(true);
    expect(await verifySendcloudSignature(body + " ", await sign(body), secret)).toBe(false);
    expect(await verifySendcloudSignature(body, "zz", secret)).toBe(false);
    expect((await deliver(new FakeProvider(), body, "0".repeat(64))).status).toBe(401);
  });
  it("relit le fournisseur au lieu de croire la notification, et déduplique les rejeux", async () => {
    const provider = new FakeProvider(); const job = await reserveLeg(db, "outbound");
    await purchaseLeg(provider, store(), job, request);
    const parcel = provider.labels.get(job)!.labelId;
    provider.status = { code: "in_transit", message: "En cours d'acheminement" };
    const body = JSON.stringify({ action: "parcel_status_changed", timestamp: 1730000000, parcel: { id: parcel, status: { message: "Delivered" } } });
    expect((await deliver(provider, body)).status).toBe(200);
    expect((await deliver(provider, body)).status).toBe(200);
    const rows = (await db.query<{ details: { code: string } }>("SELECT details FROM marketplace_round_trip_label_events WHERE job_id=$1 AND kind='tracking_update'", [job])).rows;
    expect(rows.map((r) => r.details.code)).toEqual(["in_transit"]);
  });
  it("ignore un colis étranger au circuit, demande une relance si le fournisseur est illisible", async () => {
    const provider = new FakeProvider();
    expect((await deliver(provider, JSON.stringify({ action: "parcel_status_changed", timestamp: 2, parcel: { id: 999 } }))).status).toBe(200);
    const job = await reserveLeg(db, "outbound");
    await purchaseLeg(provider, store(), job, request);
    provider.findUnknown = true;
    const body = JSON.stringify({ action: "parcel_status_changed", timestamp: 3, parcel: { id: provider.labels.get(job)!.labelId } });
    expect((await deliver(provider, body)).status).toBe(503);
  });
  it("retour introuvable par référence : relit le colis par son identifiant", async () => {
    const provider = new FakeProvider(); const job = await reserveLeg(db, "outbound");
    await purchaseLeg(provider, store(), job, request);
    const label = provider.labels.get(job)!;
    provider.status = { code: "1000", message: "Ready to send" };
    provider.findByReference = async () => null;
    Object.assign(provider, { findByLabelId: async (id: string) => (id === label.labelId ? label : null) });
    const body = JSON.stringify({ action: "parcel_status_changed", timestamp: 4, parcel: { id: label.labelId } });
    expect((await deliver(provider, body)).status).toBe(200);
    const rows = (await db.query<{ details: { code: string } }>("SELECT details FROM marketplace_round_trip_label_events WHERE job_id=$1 AND kind='tracking_update'", [job])).rows;
    expect(rows.map((r) => r.details.code)).toEqual(["1000"]);
  });
  it("transmet le code de la méthode à la relecture après une réponse perdue", async () => {
    const provider = new FakeProvider(); const job = await reserveLeg(db, "outbound");
    provider.script = ["lose_response"];
    await purchaseLeg(provider, store(), job, request);
    const hints: unknown[] = [];
    const original = provider.findByReference.bind(provider);
    provider.findByReference = async (reference: string, hint?: { shippingOptionCode?: string }) => { hints.push(hint); return original(reference); };
    await purchaseLeg(provider, store(), job, request);
    expect(hints).toContainEqual({ shippingOptionCode: "qa:option" });
  });
  it("statut relu annulé ou refusé : l'étiquette confirmée passe « annulée », sans remboursement présumé", async () => {
    const provider = new FakeProvider(); const job = await reserveLeg(db, "outbound");
    await purchaseLeg(provider, store(), job, request);
    provider.status = { code: "CANCELLED", message: "Cancelled" };
    const body = JSON.stringify({ action: "parcel_status_changed", timestamp: 5, parcel: { id: provider.labels.get(job)!.labelId } });
    expect((await deliver(provider, body)).status).toBe(200);
    expect(await status(job)).toBe("cancelled");
    const refunded = await db.query<{ r: number | null }>("SELECT refunded_cost_ttc_cents r FROM marketplace_round_trip_label_jobs WHERE id=$1", [job]);
    expect(refunded.rows[0].r).toBeNull();
    expect((await deliver(provider, body)).status).toBe(200);
  });
  it("recherche par référence illisible : relit le colis rattaché par son identifiant (revue P2-E)", async () => {
    const provider = new FakeProvider(); const job = await reserveLeg(db, "outbound");
    await purchaseLeg(provider, store(), job, request);
    const label = provider.labels.get(job)!;
    provider.findUnknown = true;
    provider.status = { code: "CANCELLED", message: "" };
    Object.assign(provider, { findByLabelId: async (id: string) => (id === label.labelId ? label : null) });
    const body = JSON.stringify({ action: "parcel_status_changed", timestamp: 7, parcel: { id: label.labelId } });
    expect((await deliver(provider, body)).status).toBe(200);
    expect(await status(job)).toBe("cancelled");
  });
  it("prévient l'équipe une seule fois quand l'étiquette devient inutilisable", async () => {
    const provider = new FakeProvider(); const job = await reserveLeg(db, "outbound");
    await purchaseLeg(provider, store(), job, request);
    provider.status = { code: "ANNOUNCEMENT_FAILED", message: "" };
    const alerts: string[] = [];
    const body = JSON.stringify({ action: "parcel_status_changed", timestamp: 6, parcel: { id: provider.labels.get(job)!.labelId } });
    const send = async () => (await handleSendcloudWebhook(new Request("https://qa.invalid/webhook", { method: "POST", body, headers: { "Sendcloud-Signature": await sign(body) } }), {
      secret, provider, store: store(), onLabelUnusable: async (id, code) => { alerts.push(`${id}:${code}`); },
      jobByProviderLabel: async (labelId) => (await db.query<{ id: string }>("SELECT id FROM marketplace_round_trip_label_jobs WHERE provider_label_id=$1", [labelId])).rows[0] ?? null,
    })).status;
    expect(await send()).toBe(200);
    expect(await send()).toBe(200);
    expect(alerts).toEqual([`${job}:ANNOUNCEMENT_FAILED`]);
  });
});

describe("résolution opérateur d'une réservation ambiguë (audit P1-2)", () => {
  const ambiguous = async (provider: FakeProvider) => {
    provider.script = ["timeout_nothing"]; const job = await reserveLeg(db, "outbound");
    await purchaseLeg(provider, store(), job, request);
    expect(await status(job)).toBe("ambiguous");
    return job;
  };
  it("adopte l'étiquette retrouvée par son n° de colis, sans nouvel achat", async () => {
    const provider = new FakeProvider(); const job = await ambiguous(provider);
    const found = { provider: "sendcloud", labelId: "777", carrier: "mondial_relay", tracking: "QA777", chargedTtcCents: null, status: null, reference: job, pdf: async () => PDF };
    Object.assign(provider, { findByLabelId: async (id: string) => (id === "777" ? found : null) });
    expect(await adoptLeg(provider, store(), job, "778")).toEqual({ state: "review_required", code: "label_not_found" });
    expect(await adoptLeg(provider, store(), job, "777")).toMatchObject({ state: "confirmed" });
    expect(await status(job)).toBe("confirmed");
    expect(provider.createCalls).toBe(1);
  });
  // Revue Codex du 16/10 : P1-B (appartenance), P1-A (statut inutilisable).
  it("refuse un colis d'une autre réservation, invérifiable ou déjà annulé", async () => {
    const provider = new FakeProvider(); const job = await ambiguous(provider);
    const label = (over: Record<string, unknown>) => ({ provider: "sendcloud", labelId: "888", carrier: "mondial_relay", tracking: "QA888", chargedTtcCents: null, status: null, reference: job, pdf: async () => PDF, ...over });
    let current: Record<string, unknown> = label({ reference: "autre-reservation" });
    Object.assign(provider, { findByLabelId: async () => current });
    expect(await adoptLeg(provider, store(), job, "888")).toEqual({ state: "review_required", code: "reference_mismatch" });
    current = label({ reference: null });
    expect(await adoptLeg(provider, store(), job, "888")).toEqual({ state: "review_required", code: "reference_unverifiable" });
    current = label({ status: { code: "2000", message: "Cancelled" } });
    expect(await adoptLeg(provider, store(), job, "888")).toEqual({ state: "review_required", code: "label_unusable" });
    expect(await status(job)).toBe("ambiguous");
  });
  // Revue Codex du 19/10 : la reprise d'un achat passe par les mêmes garde-fous que l'adoption.
  it("reprise d'achat : une étiquette retrouvée mais annulée n'est jamais mise à disposition", async () => {
    const provider = new FakeProvider(); provider.script = ["lose_response"];
    const job = await reserveLeg(db, "outbound");
    await purchaseLeg(provider, store(), job, request);
    expect(await status(job)).toBe("ambiguous");
    provider.status = { code: "2000", message: "Cancelled" };
    expect(await purchaseLeg(provider, store(), job, request)).toEqual({ state: "review_required", code: "label_unusable" });
    expect(await status(job)).toBe("ambiguous");
    expect(provider.createCalls).toBe(1);
  });
  it("webhook qui annule entre la lecture d'état et l'écriture : pas d'erreur, statut annulé", async () => {
    const provider = new FakeProvider(); const job = await reserveLeg(db, "outbound");
    const base = store();
    let raced = false;
    const racing: LabelJobStore = { ...base, async transition(id, kind, details, eventId) {
      if (kind === "cancelled" && !raced) { raced = true; await base.transition(id, "cancelled", { provider: "sendcloud", reference: "webhook", source: "provider_status" }); }
      return base.transition(id, kind, details, eventId);
    } };
    Object.assign(provider, { findByLabelId: async () => ({ ...provider.labels.get(job)!, status: { code: "2000", message: "Cancelled" } }) });
    expect(await purchaseLeg(provider, racing, job, request)).toEqual({ state: "review_required", code: "label_unusable" });
    expect(await status(job)).toBe("cancelled");
  });
  it("relecture après confirmation idempotente quand le webhook a déjà annulé", async () => {
    const provider = new FakeProvider(); const job = await reserveLeg(db, "outbound");
    Object.assign(provider, { findByLabelId: async () => {
      await store().transition(job, "cancelled", { provider: "sendcloud", reference: "webhook", source: "provider_status" });
      return { ...provider.labels.get(job)!, status: { code: "2000", message: "Cancelled" } };
    } });
    expect(await purchaseLeg(provider, store(), job, request)).toEqual({ state: "review_required", code: "label_unusable" });
    expect(await status(job)).toBe("cancelled");
  });
  it("relit le statut après confirmation : une annulation arrivée pendant l'adoption est rattrapée", async () => {
    const provider = new FakeProvider(); const job = await ambiguous(provider);
    let reads = 0;
    const base = { provider: "sendcloud", labelId: "999", carrier: "mondial_relay", tracking: "QA999", chargedTtcCents: null, reference: job, pdf: async () => PDF };
    Object.assign(provider, { findByLabelId: async () => (++reads === 1 ? { ...base, status: null } : { ...base, status: { code: "2000", message: "Cancelled" } }) });
    expect(await adoptLeg(provider, store(), job, "999")).toEqual({ state: "review_required", code: "label_unusable" });
    expect(await status(job)).toBe("cancelled");
  });
  it("constat d'absence : échec tracé, puis remplacement manuel explicite possible", async () => {
    const provider = new FakeProvider(); const job = await ambiguous(provider);
    await expect(store().transition(job, "purchase_failed", { provider: "sendcloud" })).rejects.toThrow(/label_transition_invalid/);
    await expect(store().transition(job, "purchase_failed", { provider: "sendcloud", resolution: "absent_confirmed", actor: RT.admin, evidence: "court" }))
      .rejects.toThrow(/label_transition_invalid/);
    expect(await declareLegAbsent(store(), job, "sendcloud", RT.admin, "Panneau Sendcloud consulté, aucun envoi")).toEqual({ state: "failed", code: "absent_confirmed" });
    expect(await status(job)).toBe("failed");
    const manual = await db.query<{ r: { outcome: string } }>("SELECT marketplace_reserve_round_trip_label_manual($1,'outbound',$2,true) r", [RT.case, RT.admin]);
    expect(manual.rows[0].r.outcome).toBe("claim");
  });
  it("deux constats d'absence simultanés : même issue propre pour les deux", async () => {
    const provider = new FakeProvider(); const job = await ambiguous(provider);
    const declare = () => declareLegAbsent(store(), job, "sendcloud", RT.admin, "Panneau Sendcloud consulté, aucun envoi");
    expect(await Promise.all([declare(), declare()])).toEqual([{ state: "failed", code: "absent_confirmed" }, { state: "failed", code: "absent_confirmed" }]);
    expect(await status(job)).toBe("failed");
  });
  it("constat d'absence gagnant pendant une adoption : PDF retiré, rien mis à disposition", async () => {
    const provider = new FakeProvider(); const job = await ambiguous(provider);
    const base = store();
    const discarded: string[] = [];
    const racing: LabelJobStore = { ...base,
      async savePrivateLabel(id, pdf) {
        await base.savePrivateLabel(id, pdf);
        await declareLegAbsent(base, id, "sendcloud", RT.admin, "Constat posé pendant l'adoption");
      },
      async discardPrivateLabel(id) { discarded.push(id); saved.delete(`${id}/label.pdf`); } };
    const label = { provider: "sendcloud", labelId: "999", carrier: "mondial_relay", tracking: "QA999", chargedTtcCents: null, reference: job,
      status: null, pdf: async () => PDF };
    Object.assign(provider, { findByLabelId: async () => label });
    expect(await adoptLeg(provider, racing, job, "999")).toEqual({ state: "review_required", code: "job_failed" });
    expect(await status(job)).toBe("failed");
    expect(discarded).toEqual([job]);
    expect(saved.has(`${job}/label.pdf`)).toBe(false);
  });
  it("une erreur de confirmation sans course remonte, sans retirer le PDF", async () => {
    const provider = new FakeProvider(); const job = await reserveLeg(db, "outbound");
    const base = store();
    const discard = vi.fn(async () => undefined);
    const broken: LabelJobStore = { ...base, discardPrivateLabel: discard, async transition(id, kind, details, eventId) {
      if (kind === "label_confirmed") throw new Error("label_transition_failed:network");
      return base.transition(id, kind, details, eventId);
    } };
    await expect(purchaseLeg(provider, broken, job, request)).rejects.toThrow("label_transition_failed:network");
    expect(discard).not.toHaveBeenCalled();
  });
  it("reconnaît les statuts fournisseur inutilisables, et eux seuls", () => {
    for (const s of [{ code: "CANCELLED", message: "" }, { code: "ANNOUNCEMENT_FAILED", message: "" }, { code: "2000", message: "Cancelled" }, { code: "1002", message: "" }])
      expect(isUnusableProviderStatus(s)).toBe(true);
    for (const s of [null, { code: "READY_TO_SEND", message: "" }, { code: "11", message: "Delivered" }, { code: "1000", message: "" }])
      expect(isUnusableProviderStatus(s)).toBe(false);
  });
});
