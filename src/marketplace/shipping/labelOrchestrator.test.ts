import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// PostgreSQL réel (PGlite) : chaque test recrée la base ; la CI parallèle dépasse les 5 s par défaut.
vi.setConfig({ testTimeout: 30_000 });
import { cancelLeg, purchaseLeg, type LabelJobStore, type TransitionKind } from "./labelOrchestrator";
import type { CancelOutcome, CreateOutcome, LabelProvider, LabelRequest, ProviderLabel } from "./labelProvider";
import { handleSendcloudWebhook, verifySendcloudSignature } from "./sendcloudWebhook";
import { putLabelObject, reserveLeg, roundTripDb } from "./roundTripTestDb.fixture";

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
});
