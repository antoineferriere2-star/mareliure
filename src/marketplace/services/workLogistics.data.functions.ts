import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Buffer } from "node:buffer";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import type { Json } from "@/integrations/supabase/types";
import { requireWorkshopAccess } from "./workshopAccess.server";
import { logisticsAppend, photoMime, type LogisticsJournal } from "@/marketplace/works/logistics";

import { logisticsPhotoId, samePhotoBytes } from "@/marketplace/works/logisticsPhoto";
import { associateLogisticsPhoto } from "@/marketplace/works/logisticsPhotoRecovery";

const bucket = "work-logistics-private";
const workInput = z.object({ workId: z.string().uuid() }).strict();
async function access(actor: string) {
  const sb = await admin();
  return { sb, binder: await requireWorkshopAccess(sb, actor) };
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
    if (!event || !["received", "incident"].includes(event.kind))
      fail(409, "Photo impossible pour ce constat.");
    let bytes: Uint8Array;
    try {
      const decoded = Buffer.from(data.base64, "base64");
      if (decoded.toString("base64") !== data.base64) fail(400, "Photo invalide.");
      bytes = decoded;
    } catch {
      fail(400, "Photo invalide.");
    }
    const mime = photoMime(bytes!);
    if (!mime || bytes!.length > 5242880)
      fail(400, "Photo JPEG, PNG ou WebP de 5 Mo maximum requise.");
    const id = await logisticsPhotoId(`${binder}/${data.workId}/${data.eventId}/${context.userId}`, bytes!);
    if (event.photos.some((photo) => photo.id === id)) return { ok: true };
    if (event.photos.length >= 8) fail(409, "Photo impossible pour ce constat.");
    const path = `${binder}/${data.workId}/${data.eventId}/${id}`;
    const uploaded = await sb.storage
      .from(bucket)
      .upload(path, bytes!, { contentType: mime!, upsert: false });
    if (uploaded.error) {
      const previous = await sb.storage.from(bucket).download(path);
      if (previous.error || !previous.data || !samePhotoBytes(bytes!, new Uint8Array(await previous.data.arrayBuffer())))
        fail(503, "La photo n’a pas été enregistrée. Réessayez.");
    }
    // On ambiguous database failure retain the private object: deleting it could destroy
    // evidence if the insert committed but its response was lost. The same content retries
    // with the same id, reuses its verified private object and repairs the association.
    await associateLogisticsPhoto(
      id,
      () => journal(context.userId, data.workId, "photo", { id, event: data.eventId }),
      async () => {
        const current = await journal(context.userId, data.workId, "read");
        return current.value.events.find((entry) => entry.id === data.eventId)?.photos;
      },
      async () => {
        const removed = await sb.storage.from(bucket).remove([path]);
        if (removed.error) fail(503, "Nettoyage de la photo non confirmé. Réessayez.");
      },
    );
    return { ok: true };
  });
