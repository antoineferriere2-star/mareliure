/**
 * Achat, reprise et annulation d'une étiquette pour UN sens d'un dossier.
 *
 * Invariants : la réservation SQL précède tout appel ; chaque appel est précédé de
 * `request_started` ; une réponse ambiguë n'est jamais suivie d'un achat « à l'aveugle » —
 * la reprise relit d'abord le fournisseur, puis ne redemande qu'avec la même référence ;
 * une annulation n'est jamais un remboursement présumé. Aucune adresse dans le journal.
 */
import { isPdf, type LabelProvider, type LabelRequest, type ProviderLabel } from "./labelProvider";

export type TransitionKind =
  | "request_started" | "response_ambiguous" | "label_confirmed" | "purchase_failed" | "tracking_update"
  | "cancellation_requested" | "cancelled" | "cost_adjusted" | "operator_note" | "unused";

export interface LabelJobView { id: string; status: "claimed" | "ambiguous" | "confirmed" | "failed" | "cancelled" }

export interface LabelJobStore {
  job(id: string): Promise<LabelJobView | null>;
  transition(id: string, kind: TransitionKind, details: Record<string, unknown>, providerEventId?: string | null): Promise<{ outcome: "applied" | "duplicate"; status: string; cost_review_required?: boolean }>;
  /** Écrit `${id}/label.pdf` dans le bucket privé ; sans écrasement, un objet identique est accepté. */
  savePrivateLabel(id: string, pdf: Uint8Array): Promise<void>;
}

export type LegResult =
  | { state: "confirmed"; costReviewRequired: boolean }
  | { state: "failed"; code: string }
  | { state: "pending"; code: string }
  | { state: "review_required"; code: string };

async function persist(store: LabelJobStore, jobId: string, label: ProviderLabel): Promise<LegResult> {
  let pdf: Uint8Array;
  try {
    pdf = await label.pdf();
    if (!isPdf(pdf)) throw new Error("label_not_pdf");
    await store.savePrivateLabel(jobId, pdf);
  } catch (error) {
    // L'étiquette existe chez le fournisseur : on garde la trace, la reprise la retrouvera.
    await store.transition(jobId, "response_ambiguous", { stage: "label_storage", provider: label.provider, provider_label_id: label.labelId,
      code: error instanceof Error ? error.message.slice(0, 80) : "storage_failed" });
    return { state: "pending", code: "label_storage" };
  }
  const result = await store.transition(jobId, "label_confirmed", { provider: label.provider, provider_label_id: label.labelId,
    carrier: label.carrier, tracking: label.tracking, charged_cost_ttc_cents: label.chargedTtcCents });
  return { state: "confirmed", costReviewRequired: Boolean(result.cost_review_required) };
}

/** Achète l'étiquette d'une réservation `claimed`, ou reprend une réservation `ambiguous`. */
export async function purchaseLeg(provider: LabelProvider, store: LabelJobStore, jobId: string, request: () => Promise<LabelRequest>): Promise<LegResult> {
  const job = await store.job(jobId);
  if (!job) return { state: "review_required", code: "job_not_found" };
  if (job.status === "confirmed") return { state: "confirmed", costReviewRequired: false };
  if (job.status === "failed" || job.status === "cancelled") return { state: "review_required", code: `job_${job.status}` };

  // Reprise : relire le fournisseur avant tout nouvel appel (la méthode dit où chercher).
  const hint = async () => ({ shippingOptionCode: (await request()).shippingOptionCode });
  if (job.status === "ambiguous") {
    const existing = await provider.findByReference(jobId, await hint());
    if (existing === "unknown") return { state: "pending", code: "provider_unreadable" };
    if (existing) return persist(store, jobId, existing);
  }
  const started = await store.transition(jobId, "request_started", { provider: provider.name });
  // Une tentative précédente sans issue enregistrée : la base a basculé en ambigu.
  if (started.status === "ambiguous" && job.status === "claimed") {
    const existing = await provider.findByReference(jobId, await hint());
    if (existing === "unknown") return { state: "pending", code: "provider_unreadable" };
    if (existing) return persist(store, jobId, existing);
  }
  const outcome = await provider.create({ ...(await request()), reference: jobId });
  switch (outcome.kind) {
    case "created": return persist(store, jobId, outcome.label);
    case "rejected": {
      const current = await store.job(jobId);
      if (current?.status === "claimed") {
        await store.transition(jobId, "purchase_failed", { provider: provider.name, code: outcome.code });
        return { state: "failed", code: outcome.code };
      }
      await store.transition(jobId, "operator_note", { provider: provider.name, code: outcome.code, note: "rejected_after_ambiguous" });
      return { state: "review_required", code: outcome.code };
    }
    case "not_created":
      await store.transition(jobId, "operator_note", { provider: provider.name, code: outcome.code, note: "not_created_retry_allowed" });
      return { state: "pending", code: outcome.code };
    case "ambiguous":
      await store.transition(jobId, "response_ambiguous", { provider: provider.name, code: outcome.code });
      return { state: "pending", code: outcome.code };
  }
}

export type CancelResult = { state: "cancelled" | "queued" | "refused" | "pending" | "review_required"; code?: string };

/** Demande l'annulation d'une étiquette confirmée. Aucun remboursement n'est présumé. */
export async function cancelLeg(provider: LabelProvider, store: LabelJobStore, jobId: string): Promise<CancelResult> {
  const job = await store.job(jobId);
  if (!job || job.status !== "confirmed") return { state: "review_required", code: job ? `job_${job.status}` : "job_not_found" };
  await store.transition(jobId, "cancellation_requested", { provider: provider.name });
  const outcome = await provider.cancel(jobId);
  switch (outcome.kind) {
    case "cancelled":
      await store.transition(jobId, "cancelled", { provider: provider.name, reference: outcome.reference });
      return { state: "cancelled" };
    case "queued":
      await store.transition(jobId, "operator_note", { provider: provider.name, note: "cancellation_queued", reference: outcome.reference });
      return { state: "queued" };
    case "refused":
      await store.transition(jobId, "operator_note", { provider: provider.name, note: "cancellation_refused", code: outcome.code });
      return { state: "refused", code: outcome.code };
    case "ambiguous":
      await store.transition(jobId, "operator_note", { provider: provider.name, note: "cancellation_ambiguous", code: outcome.code });
      return { state: "pending", code: outcome.code };
  }
}

/**
 * Résolution opérateur d'une réservation ambiguë (audit du 15/10, P1-2) : adoption d'une étiquette
 * retrouvée chez le fournisseur, relue par son identifiant de colis — jamais sur simple déclaration.
 */
export async function adoptLeg(provider: LabelProvider, store: LabelJobStore, jobId: string, labelId: string): Promise<LegResult> {
  const job = await store.job(jobId);
  if (!job || job.status !== "ambiguous") return { state: "review_required", code: job ? `job_${job.status}` : "job_not_found" };
  if (!provider.findByLabelId) return { state: "review_required", code: "provider_lookup_unsupported" };
  const label = await provider.findByLabelId(labelId.trim());
  if (label === "unknown") return { state: "pending", code: "provider_unreadable" };
  if (!label) return { state: "review_required", code: "label_not_found" };
  return persist(store, jobId, label);
}

/** Constat écrit qu'aucune étiquette n'existe chez le fournisseur : la réservation ambiguë devient « échouée ». */
export async function declareLegAbsent(store: LabelJobStore, jobId: string, provider: string, actor: string, evidence: string): Promise<LegResult> {
  const job = await store.job(jobId);
  if (!job || job.status !== "ambiguous") return { state: "review_required", code: job ? `job_${job.status}` : "job_not_found" };
  await store.transition(jobId, "purchase_failed", { provider, resolution: "absent_confirmed", actor, evidence: evidence.trim().slice(0, 500) });
  return { state: "failed", code: "absent_confirmed" };
}

/**
 * Statut fournisseur qui rend l'étiquette inutilisable (annulée, ou refusée par le transporteur après coup) :
 * codes v3 (`CANCELLED`, `ANNOUNCEMENT_FAILED`) et v2 (2000 annulé, 1002 annonce échouée).
 */
export function isUnusableProviderStatus(status: { code: string; message: string } | null): boolean {
  if (!status) return false;
  return /^(2000|1002)$/.test(status.code) || /CANCEL|ANNOUNCEMENT_FAILED/i.test(status.code);
}
