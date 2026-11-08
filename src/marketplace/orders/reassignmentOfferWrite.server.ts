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

/**
 * Le nouvel `offered_at` doit être strictement postérieur à l'ancien, sinon le filtre
 * `offered_at = <ancien>` ne départage plus deux écritures concurrentes (5e revue Codex : heure
 * égale à la milliseconde, `UPDATE 1` deux fois). L'ancien peut porter des microsecondes : on part
 * de sa milliseconde tronquée + 1, donc toujours au-delà.
 */
export function nextOfferInstant(previous: string | null, now: string): string {
  const before = previous === null ? Number.NaN : Date.parse(previous);
  const current = Date.parse(now);
  if (Number.isNaN(before) || current > before) return now;
  return new Date(before + 1).toISOString();
}

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
    // Compare-and-swap sur tout ce que la décision a lu, pas seulement `updated_at` : le déclencheur
    // lui donne `now()`, qui n'est pas garanti unique d'une écriture à l'autre (3e revue Codex).
    // L'ancien état, l'absence d'accord, l'ancienne rémunération et l'ancien `offered_at` suffisent
    // à reconnaître qu'un autre appel est passé, quelle que soit la valeur de `updated_at` : toute
    // réécriture pose un `offered_at` strictement postérieur (`nextOfferInstant`), y compris quand seule la
    // prestation change. La prestation elle-même n'est pas filtrée : jusqu'à 2 000 caractères, elle
    // ferait dépasser à l'URL PostgREST la limite de 16 Ko de Cloudflare (4e revue Codex).
    const offeredAt = nextOfferInstant(existing.offered_at, now);
    let write = sb.from("marketplace_quotes").update({
      state: "offered", binder_payout_cents: input.payoutCents, amount_cents: input.payoutCents,
      service_description: input.serviceDescription, offered_at: offeredAt, accepted_at: null, declined_at: null,
      decline_reason_code: null, decline_reason_detail: null, updated_at: now,
    }).eq("id", existing.id).eq("updated_at", existing.updated_at).is("agreement_version", null);
    const unchangedSince: Array<[string, string | number | null]> = [
      ["state", existing.state], ["binder_payout_cents", existing.binder_payout_cents],
      ["offered_at", existing.offered_at],
    ];
    for (const [column, value] of unchangedSince)
      write = value === null ? write.is(column as never, null) : write.eq(column as never, value as never);
    const { data: rows, error: upError } = await write.select("id");
    if (upError) fail(500, upError.message);
    return rows && rows.length > 0 ? { outcome: "written", offeredAt } : superseded();
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
