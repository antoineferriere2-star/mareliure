/**
 * Webhook Sendcloud : authentifié, puis rapproché du fournisseur.
 *
 * Signature (documentation Sendcloud) : en-tête `Sendcloud-Signature`, HMAC-SHA256 hexadécimal du
 * corps brut avec la clé secrète. Le contenu n'est jamais cru tel quel : le statut est relu chez le
 * fournisseur avant d'être ajouté au journal. Réponse 2xx uniquement après écriture durable ;
 * Sendcloud réessaie sinon (10 fois, jusqu'à une heure d'intervalle). Une livraison transporteur
 * n'est jamais une réception physique : l'atelier la confirme séparément.
 */
import type { LabelProvider } from "./labelProvider";
import type { LabelJobStore } from "./labelOrchestrator";

const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function verifySendcloudSignature(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!header || !secret || !/^[0-9a-f]{64}$/i.test(header)) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody)));
  const given = header.toLowerCase();
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

export interface WebhookDeps {
  secret: string;
  provider: LabelProvider;
  store: LabelJobStore;
  /** Réservation correspondant à un colis du fournisseur, ou `null` (colis étranger au circuit). */
  jobByProviderLabel(labelId: string): Promise<{ id: string } | null>;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export async function handleSendcloudWebhook(request: Request, deps: WebhookDeps): Promise<Response> {
  const raw = await request.text();
  if (!(await verifySendcloudSignature(raw, request.headers.get("sendcloud-signature"), deps.secret))) return json(401, { error: "invalid_signature" });
  let payload: { action?: string; timestamp?: number | string; parcel?: { id?: number | string } };
  try { payload = JSON.parse(raw); } catch { return json(400, { error: "invalid_body" }); }
  const parcelId = payload.parcel?.id === undefined ? null : String(payload.parcel.id);
  if (payload.action !== "parcel_status_changed" || !parcelId || payload.timestamp === undefined) return json(200, { ignored: true });
  const job = await deps.jobByProviderLabel(parcelId);
  // Colis sans réservation dans ce circuit : rien à écrire, aucune relance utile.
  if (!job) return json(200, { ignored: true });
  // Rapprochement : l'état fait foi chez le fournisseur, pas dans la notification.
  const current = await deps.provider.findByReference(job.id);
  if (current === "unknown") return json(503, { error: "provider_unreadable" });
  if (!current || current.labelId !== parcelId) return json(409, { error: "reconciliation_mismatch" });
  await deps.store.transition(job.id, "tracking_update",
    { provider: deps.provider.name, provider_label_id: parcelId, code: current.status?.code ?? "unknown", message: (current.status?.message ?? "").slice(0, 200) },
    `${parcelId}:${payload.timestamp}`);
  return json(200, { ok: true });
}
