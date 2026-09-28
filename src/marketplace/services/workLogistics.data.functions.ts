import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import type { Json } from "@/integrations/supabase/types";
import { requireBinderId } from "./binderQuotes.server";
import { logisticsAppend, photoMime, type LogisticsJournal } from "@/marketplace/works/logistics";

const bucket = "work-logistics-private";
const workInput = z.object({ workId: z.string().uuid() }).strict();
async function access(actor: string) {
  const sb = await admin();
  return { sb, binder: await requireBinderId(sb, actor) };
}
async function journal(actor: string, work: string, action: string, data: Json = {}) {
  const { sb, binder } = await access(actor);
  const result = await sb.rpc("marketplace_work_logistics", {
    p_work: work,
    p_binder: binder,
    p_actor: actor,
    p_action: action,
    p_data: data,
  });
  if (result.error)
    fail(
      409,
      "Suivi indisponible ou modifié. Rechargez la fiche et vérifiez les informations obligatoires.",
    );
  return { sb, binder, value: result.data as unknown as LogisticsJournal };
}
export const readWorkLogistics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => workInput.parse(value))
  .handler(async ({ context, data }) => {
    const { sb, value } = await journal(context.userId, data.workId, "read");
    for (const event of value.events)
      for (const photo of event.photos) {
        const signed = await sb.storage.from(bucket).createSignedUrl(photo.path, 60);
        photo.url = signed.data?.signedUrl;
        photo.path = ""; // Do not expose internal object names in the view.
      }
    return value;
  });
export const appendWorkLogistics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => logisticsAppend.parse(value))
  .handler(async ({ context, data }) => {
    await journal(context.userId, data.workId, "append", {
      id: data.id,
      version: data.version,
      kind: data.kind,
      details: data.details,
    });
    return { ok: true };
  });
export const uploadLogisticsPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    workInput
      .extend({ eventId: z.string().uuid(), base64: z.string().min(16).max(6990508) })
      .strict()
      .parse(value),
  )
  .handler(async ({ context, data }) => {
    const { sb, binder, value } = await journal(context.userId, data.workId, "read");
    const event = value.events.find((e) => e.id === data.eventId);
    if (!event || !["received", "incident"].includes(event.kind) || event.photos.length >= 8)
      fail(409, "Photo impossible pour ce constat.");
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    } catch {
      fail(400, "Photo invalide.");
    }
    const mime = photoMime(bytes!);
    if (!mime || bytes!.length > 5242880)
      fail(400, "Photo JPEG, PNG ou WebP de 5 Mo maximum requise.");
    const id = crypto.randomUUID();
    const path = `${binder}/${data.workId}/${data.eventId}/${id}`;
    const uploaded = await sb.storage
      .from(bucket)
      .upload(path, bytes!, { contentType: mime!, upsert: false });
    if (uploaded.error) fail(503, "La photo n’a pas été enregistrée. Réessayez.");
    // On ambiguous database failure retain the private object: deleting it could destroy
    // evidence if the insert committed but its response was lost. Reconcile orphans in recipe.
    await journal(context.userId, data.workId, "photo", { id, event: data.eventId });
    return { ok: true };
  });
