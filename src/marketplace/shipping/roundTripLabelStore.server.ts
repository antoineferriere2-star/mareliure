/**
 * Magasin serveur des réservations d'étiquettes : la machine d'états SQL et le bucket privé.
 * Service-role uniquement ; rien n'est exposé au navigateur.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LabelJobStore, LabelJobView, TransitionKind } from "./labelOrchestrator";
import { isPdf } from "./labelProvider";

export const ROUND_TRIP_LABELS_BUCKET = "round-trip-labels-private";

// L'ouverture de l'achat automatique n'est plus une constante : table
// `marketplace_round_trip_automation` (fermée par défaut, ouverture justifiée et tracée,
// fermeture immédiate), plus les clés fournisseur présentes et un tarif revu par dossier.

// Les tables de cette branche ne sont pas encore dans les types générés : frontière validée ici.
type Untyped = SupabaseClient;

export function supabaseLabelStore(client: unknown): LabelJobStore {
  const sb = client as Untyped;
  return {
    async job(id): Promise<LabelJobView | null> {
      const { data, error } = await sb.from("marketplace_round_trip_label_jobs").select("id,status").eq("id", id).maybeSingle();
      if (error) throw new Error("label_job_unreadable");
      return (data as LabelJobView | null) ?? null;
    },
    async transition(id, kind: TransitionKind, details, providerEventId = null) {
      const { data, error } = await sb.rpc("marketplace_round_trip_label_transition",
        { p_job: id, p_kind: kind, p_provider_event_id: providerEventId, p_details: details });
      if (error) throw new Error(`label_transition_failed:${String(error.message).slice(0, 80)}`);
      return data as { outcome: "applied" | "duplicate"; status: string; cost_review_required?: boolean };
    },
    async savePrivateLabel(id, pdf) {
      if (!isPdf(pdf)) throw new Error("label_not_pdf");
      const path = `${id}/label.pdf`;
      const bucket = sb.storage.from(ROUND_TRIP_LABELS_BUCKET);
      const uploaded = await bucket.upload(path, pdf, { contentType: "application/pdf", upsert: false });
      if (!uploaded.error) return;
      // Reprise : l'objet existe déjà. Jamais d'écrasement ; seuls des octets identiques sont acceptés.
      const existing = await bucket.download(path);
      if (existing.error || !existing.data) throw new Error("label_storage_failed");
      const bytes = new Uint8Array(await existing.data.arrayBuffer());
      if (bytes.length !== pdf.length || bytes.some((byte, index) => byte !== pdf[index])) throw new Error("label_object_conflict");
    },
  };
}
