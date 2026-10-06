import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Buffer } from "node:buffer";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import type { Json } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isPdf } from "@/marketplace/shipping/labelProvider";
import { workshopTransportOptionsInput } from "@/marketplace/works/workshopTransport";
import { requireWorkshopAccess } from "./workshopAccess.server";
import { logisticsAppend, photoMime, type LogisticsJournal } from "@/marketplace/works/logistics";

import { logisticsPhotoId, samePhotoBytes } from "@/marketplace/works/logisticsPhoto";
import { associateLogisticsPhoto } from "@/marketplace/works/logisticsPhotoRecovery";

const bucket = "work-logistics-private";
const workInput = z.object({ workId: z.string().uuid() }).strict();
export const getWorkTransportOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => workInput.parse(value))
  .handler(async ({ context, data }) => {
    const { sb, binder } = await access(context.userId);
    const work = await sb
      .from("marketplace_binder_works")
      .select("source")
      .eq("id", data.workId)
      .eq("binder_id", binder)
      .single();
    if (work.error) fail(404, "Ouvrage introuvable.");
    const quotes = await sb
      .from("marketplace_binder_quotes")
      .select("id")
      .eq("binder_id", binder)
      .eq("work_id", data.workId);
    if (quotes.error) throw quotes.error;
    if (!quotes.data?.length)
      return {
        ownClient: ["mon_client", "workshop_platform"].includes(work.data!.source),
        invoices: [],
      };
    const invoices = await sb
      .from("marketplace_binder_invoices")
      .select("id,invoice_number")
      .eq("binder_id", binder)
      .eq("status", "issued")
      .in(
        "quote_id",
        quotes.data.map((q) => q.id),
      );
    if (invoices.error) throw invoices.error;
    return {
      ownClient: ["mon_client", "workshop_platform"].includes(work.data!.source),
      invoices: invoices.data ?? [],
    };
  });
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
    if (value.events.length) {
      const labels = await (sb as unknown as SupabaseClient).from("marketplace_work_logistics_labels").select("id,event_id,path").in("event_id", value.events.map(e => e.id));
      if (labels.error) throw labels.error;
      for (const event of value.events) {
        event.labels = [];
        for (const label of labels.data ?? []) if (label.event_id === event.id) {
          const signed = await sb.storage.from("work-transport-labels-private").createSignedUrl(label.path, 60);
          event.labels.push({ id: label.id, url: signed.data?.signedUrl });
        }
      }
    }
    for (const event of value.events)
      for (const photo of event.photos) {
        const signed = await sb.storage.from(bucket).createSignedUrl(photo.path, 60);
        photo.url = signed.data?.signedUrl;
        photo.path = ""; // Do not expose internal object names in the view.
      }
    return value;
  });

export const getWorkshopTransportOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => workshopTransportOptionsInput.parse(value))
  .handler(async ({ context, data }) => {
    const { sb, binder } = await access(context.userId);
    const { workshopTransportOptions } = await import("./workshopTransport.server");
    return workshopTransportOptions(sb, binder, data);
  });

/** Existing provider label only: this uploads a private PDF, it never purchases transport. */
export const uploadWorkTransportLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => workInput.extend({ eventId: z.string().uuid(), base64: z.string().min(16).max(6990508) }).strict().parse(value))
  .handler(async ({ context, data }) => {
    const { sb, binder, value } = await journal(context.userId, data.workId, "read");
    const event = value.events.find(e => e.id === data.eventId);
    if (!event || !["outbound", "return"].includes(event.kind) || event.details.mode !== "parcel") fail(409, "Trajet colis requis.");
    const work = await sb.from("marketplace_binder_works").select("source").eq("id", data.workId).eq("binder_id", binder).single();
    if (work.error || !["mon_client", "workshop_platform"].includes(work.data!.source)) fail(404, "Ouvrage client propre introuvable.");
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.toString("base64") !== data.base64 || !isPdf(bytes)) fail(400, "Étiquette PDF de 5 Mo maximum requise.");
    const id = await logisticsPhotoId(`label/${binder}/${data.workId}/${data.eventId}/${context.userId}`, bytes);
    const path = `${binder}/${data.workId}/${data.eventId}/${id}.pdf`;
    const uploaded = await sb.storage.from("work-transport-labels-private").upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (uploaded.error) {
      const previous = await sb.storage.from("work-transport-labels-private").download(path);
      if (previous.error || !previous.data || !samePhotoBytes(bytes, new Uint8Array(await previous.data.arrayBuffer()))) fail(503, "Étiquette non confirmée. Réessayez.");
    }
    const attached = await (sb as unknown as SupabaseClient).rpc("marketplace_attach_work_transport_label", { p_work: data.workId, p_binder: binder, p_actor: context.userId, p_event: data.eventId, p_id: id });
    // Keep an ambiguously committed object; same bytes retry with the same id and repair the association.
    if (attached.error) fail(409, "Rattachement de l’étiquette non confirmé. Relisez le trajet et réessayez.");
    return { ok: true };
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
    const id = await logisticsPhotoId(
      `${binder}/${data.workId}/${data.eventId}/${context.userId}`,
      bytes!,
    );
    if (event.photos.some((photo) => photo.id === id)) return { ok: true };
    if (event.photos.length >= 8) fail(409, "Photo impossible pour ce constat.");
    const path = `${binder}/${data.workId}/${data.eventId}/${id}`;
    const uploaded = await sb.storage
      .from(bucket)
      .upload(path, bytes!, { contentType: mime!, upsert: false });
    if (uploaded.error) {
      const previous = await sb.storage.from(bucket).download(path);
      if (
        previous.error ||
        !previous.data ||
        !samePhotoBytes(bytes!, new Uint8Array(await previous.data.arrayBuffer()))
      )
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
