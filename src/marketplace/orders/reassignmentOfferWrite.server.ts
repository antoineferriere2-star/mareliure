/**
 * Réattribution : écrire l'offre faite au nouvel atelier, et dire si cet appel est celui qui l'a créée.
 *
 * Contre-revue Codex de #190 (8 novembre 2026) : deux clics simultanés lisaient le même ancien état
 * (offre refusée, ou conditions changées), réécrivaient chacun l'offre avec leur propre heure et
 * envoyaient deux e-mails. L'écriture est désormais conditionnelle : la mise à jour ne passe que si
 * la ligne n'a pas bougé depuis la lecture (`updated_at`, rafraîchi par le déclencheur
 * `marketplace_quotes_touch`), et la création s'appuie sur l'unicité `(case_id, binder_id)`.
 * PostgreSQL réévalue la condition après le verrou de ligne : un seul des deux appels écrit,
 * l'autre reçoit `superseded` et ne notifie pas, ne journalise pas.
 */
import type { Supa } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { reassignmentOfferTiming } from "./reassignmentOffer";

export type ReassignmentOfferOutcome =
  /** Nouvelle offre ou conditions modifiées : cet appel l'a écrite, il l'annonce. */
  | "written"
  /** Même offre encore en attente : rien n'est réécrit ; seule une notice échouée est reprise. */
  | "unchanged"
  /** Accord déjà signé : réactivé, sans nouvelle offre à examiner. */
  | "reactivated"
  /** Un autre appel simultané a écrit l'offre : celui-ci n'envoie rien. */
  | "superseded";

export interface ReassignmentOfferResult {
  outcome: ReassignmentOfferOutcome;
  offeredAt: string;
}

const UNIQUE_VIOLATION = "23505";

export async function saveReassignmentOffer(
  sb: Supa,
  input: { caseId: string; binderId: string; payoutCents: number; serviceDescription: string },
  now: string,
): Promise<ReassignmentOfferResult> {
  const { data: existing, error } = await sb
    .from("marketplace_quotes")
    .select("id, state, agreement_version, binder_payout_cents, service_description, offered_at, updated_at")
    .eq("case_id", input.caseId)
    .eq("binder_id", input.binderId)
    .maybeSingle();
  if (error) fail(500, error.message);
  const timing = reassignmentOfferTiming(existing ?? null, input, now);

  if (existing?.agreement_version) {
    if (existing.binder_payout_cents !== input.payoutCents)
      fail(409, "Cet atelier a déjà accepté ce dossier à une autre rémunération : son accord ne se réécrit pas.");
    const { error: reError } = await sb.from("marketplace_quotes").update({ state: "accepted", updated_at: now }).eq("id", existing.id);
    if (reError) fail(500, reError.message);
    return { outcome: "reactivated", offeredAt: timing.offeredAt };
  }

  if (existing && !timing.rewrite) return { outcome: "unchanged", offeredAt: timing.offeredAt };

  // Perdu la course : si l'offre écrite par l'autre appel porte ces mêmes conditions, c'est un double
  // clic, rien à faire. Sinon, deux réglages différents se sont croisés : l'admin doit le savoir.
  const superseded = async (): Promise<ReassignmentOfferResult> => {
    const { data: current, error: reError } = await sb
      .from("marketplace_quotes")
      .select("id, state, agreement_version, binder_payout_cents, service_description, offered_at")
      .eq("case_id", input.caseId)
      .eq("binder_id", input.binderId)
      .maybeSingle();
    if (reError) fail(500, reError.message);
    const again = reassignmentOfferTiming(current ?? null, input, now);
    if (!current || again.rewrite)
      fail(409, "L'offre de cet atelier vient d'être modifiée par un autre envoi. Rechargez le dossier avant de la proposer à nouveau.");
    return { outcome: "superseded", offeredAt: again.offeredAt };
  };

  if (existing) {
    const { data: rows, error: upError } = await sb.from("marketplace_quotes").update({
      state: "offered", binder_payout_cents: input.payoutCents, amount_cents: input.payoutCents,
      service_description: input.serviceDescription, offered_at: now, accepted_at: null, declined_at: null,
      decline_reason_code: null, decline_reason_detail: null, updated_at: now,
    }).eq("id", existing.id).eq("updated_at", existing.updated_at).select("id");
    if (upError) fail(500, upError.message);
    return rows && rows.length > 0 ? { outcome: "written", offeredAt: now } : superseded();
  }

  const { error: insError } = await sb.from("marketplace_quotes").insert({
    case_id: input.caseId, binder_id: input.binderId, description: "Offre Oppe (réattribution)",
    amount_cents: input.payoutCents, currency: "EUR", state: "offered", customer_price_cents: null,
    binder_payout_cents: input.payoutCents, service_description: input.serviceDescription, offered_at: now,
  });
  if (insError?.code === UNIQUE_VIOLATION) return superseded();
  if (insError) fail(500, insError.message);
  return { outcome: "written", offeredAt: now };
}
