/**
 * La bibliothèque de photos d'exemple de l'atelier, par opération.
 *
 * Une photo appartient à UNE opération : une prestation de l'atelier
 * (`serviceId`) ou un tarif de base Ma Reliure (`pricingKey`). Tout passe par
 * l'atelier résolu depuis la session ; une prestation d'un autre atelier ou une
 * clé inconnue est refusée. Les devis n'en reçoivent que des copies
 * (`attachOperationPhotoToQuoteItem`).
 */
import type { Supa } from "@/build/services/adminAuth.server";
import { WORK_ITEMS } from "@/marketplace/pricing/catalog";
import {
  QUOTE_OPERATION_PHOTO_MAX_BYTES,
  QUOTE_OPERATION_PHOTO_MAX_PER_LINE,
  QUOTE_OPERATION_PHOTO_MIME_TYPES,
  QUOTE_OPERATION_PHOTOS_BUCKET,
  type OperationPhotoTarget,
  type OperationPhotoView,
  type QuoteOperationPhotoMime,
} from "@/marketplace/quotes/quotePhotos";
import { BinderQuotesError } from "./binderQuotes.server";

const TABLE = "marketplace_binder_operation_photos";
const knownPricingKeys = new Set(WORK_ITEMS.map((item) => item.key));

async function assertOwnTarget(sb: Supa, binderId: string, target: OperationPhotoTarget) {
  if ("pricingKey" in target) {
    if (!knownPricingKeys.has(target.pricingKey)) throw new BinderQuotesError("invalid_input");
    return;
  }
  const { data, error } = await sb.from("marketplace_binder_services")
    .select("id").eq("id", target.serviceId).eq("binder_id", binderId).maybeSingle();
  if (error) throw new BinderQuotesError("failed");
  if (!data) throw new BinderQuotesError("not_found");
}

function targetFilter(target: OperationPhotoTarget) {
  return "pricingKey" in target ? (["pricing_key", target.pricingKey] as const) : (["service_id", target.serviceId] as const);
}

export async function listOperationPhotos(sb: Supa, binderId: string): Promise<OperationPhotoView[]> {
  const { data, error } = await sb.from(TABLE)
    .select("id, service_id, pricing_key, storage_path, caption, position")
    .eq("binder_id", binderId).order("position");
  if (error) throw new BinderQuotesError("failed");
  return Promise.all((data ?? []).map(async (row) => {
    const { data: signed, error: signError } = await sb.storage
      .from(QUOTE_OPERATION_PHOTOS_BUCKET).createSignedUrl(row.storage_path, 3600);
    if (signError || !signed?.signedUrl) throw new BinderQuotesError("failed");
    return { id: row.id, serviceId: row.service_id, pricingKey: row.pricing_key, caption: row.caption, position: row.position, url: signed.signedUrl };
  }));
}

export async function uploadOperationPhoto(sb: Supa, binderId: string, input: {
  target: OperationPhotoTarget;
  mimeType: QuoteOperationPhotoMime;
  imageBase64: string;
  caption: string | null;
}): Promise<{ id: string }> {
  if (!QUOTE_OPERATION_PHOTO_MIME_TYPES.includes(input.mimeType)) throw new BinderQuotesError("invalid_input");
  await assertOwnTarget(sb, binderId, input.target);
  const [column, value] = targetFilter(input.target);
  const { data: existing, error: countError } = await sb.from(TABLE).select("id").eq("binder_id", binderId).eq(column, value);
  if (countError) throw new BinderQuotesError("failed");
  if ((existing ?? []).length >= QUOTE_OPERATION_PHOTO_MAX_PER_LINE) throw new BinderQuotesError("invalid_input");
  const bytes = Buffer.from(input.imageBase64, "base64");
  if (bytes.length === 0 || bytes.length > QUOTE_OPERATION_PHOTO_MAX_BYTES) throw new BinderQuotesError("invalid_input");
  const extension = input.mimeType === "image/png" ? "png" : "jpg";
  const storagePath = `${binderId}/library/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await sb.storage.from(QUOTE_OPERATION_PHOTOS_BUCKET)
    .upload(storagePath, bytes, { contentType: input.mimeType, upsert: false });
  if (uploadError) throw new BinderQuotesError("failed");
  const { data, error } = await sb.from(TABLE).insert({
    binder_id: binderId,
    service_id: "serviceId" in input.target ? input.target.serviceId : null,
    pricing_key: "pricingKey" in input.target ? input.target.pricingKey : null,
    storage_path: storagePath,
    caption: input.caption,
    position: (existing ?? []).length + 1,
  }).select("id").single();
  if (error || !data) {
    await sb.storage.from(QUOTE_OPERATION_PHOTOS_BUCKET).remove([storagePath]);
    throw new BinderQuotesError("failed");
  }
  return { id: data.id };
}

export async function updateOperationPhotoCaption(sb: Supa, binderId: string, photoId: string, caption: string | null): Promise<void> {
  const { data, error } = await sb.from(TABLE).update({ caption }).eq("id", photoId).eq("binder_id", binderId).select("id").maybeSingle();
  if (error) throw new BinderQuotesError("failed");
  if (!data) throw new BinderQuotesError("not_found");
}

/** Retire l'exemple de la bibliothèque. Les devis qui l'ont repris gardent leur propre copie. */
export async function deleteOperationPhoto(sb: Supa, binderId: string, photoId: string): Promise<void> {
  const { data: photo, error } = await sb.from(TABLE)
    .select("id, storage_path").eq("id", photoId).eq("binder_id", binderId).maybeSingle();
  if (error) throw new BinderQuotesError("failed");
  if (!photo) throw new BinderQuotesError("not_found");
  const { error: deleteError } = await sb.from(TABLE).delete().eq("id", photoId).eq("binder_id", binderId);
  if (deleteError) throw new BinderQuotesError("failed");
  // Le fichier part après la ligne : un échec ici laisse un fichier orphelin, jamais une ligne sans fichier.
  await sb.storage.from(QUOTE_OPERATION_PHOTOS_BUCKET).remove([photo.storage_path]);
}
