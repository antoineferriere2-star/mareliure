import { FERRIERE_SERVICE_PHOTO_NUMBERS, FERRIERE_SERVICE_PHOTO_CREDIT, ferriereServicePhoto, type IllustratedServiceKey } from "@/marketplace/pages/pricing/ferriereServiceIllustrations";

export const QUOTE_OPERATION_PHOTOS_BUCKET = "marketplace-quote-operation-photos";
export const QUOTE_OPERATION_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const QUOTE_OPERATION_PHOTO_MIME_TYPES = ["image/jpeg", "image/png"] as const;
export const QUOTE_OPERATION_PHOTO_MAX_PER_LINE = 6;

export type QuoteOperationPhotoMime = (typeof QUOTE_OPERATION_PHOTO_MIME_TYPES)[number];

/** L'opération d'un exemple : une prestation de l'atelier, ou un tarif de base Ma Reliure. Jamais les deux. */
export type OperationPhotoTarget = { serviceId: string } | { pricingKey: string };

/** Un exemple de la bibliothèque, tel que le serveur le renvoie (URL signée, une heure). */
export interface OperationPhotoView {
  id: string;
  serviceId: string | null;
  pricingKey: string | null;
  caption: string | null;
  position: number;
  url: string;
  isDefault?: boolean;
}

export function defaultOperationPhoto(pricingKey: string): OperationPhotoView | null {
  if (!Object.hasOwn(FERRIERE_SERVICE_PHOTO_NUMBERS, pricingKey)) return null;
  return {
    id: `default:${pricingKey}`, serviceId: null, pricingKey,
    caption: `Illustration — ${FERRIERE_SERVICE_PHOTO_CREDIT}`,
    position: 0, url: ferriereServicePhoto(pricingKey as IllustratedServiceKey).src, isDefault: true,
  };
}

/** Copie PNG indépendante pour les devis et PDF ; seules nos images locales sont admises. */
export async function defaultPhotoFile(photoId: string): Promise<File> {
  const photo = photoId.startsWith("default:") ? defaultOperationPhoto(photoId.slice(8)) : null;
  if (!photo) throw new Error("invalid_default_photo");
  const image = new Image();
  image.src = photo.url;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("photo_copy_failed");
  context.drawImage(image, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("photo_copy_failed")), "image/png"));
  return new File([blob], `${photo.pricingKey}.png`, { type: "image/png" });
}

/** L'opération d'une ligne de devis, si elle en a une : une ligne libre n'a pas de bibliothèque. */
export function photoTargetOfLine(line: { serviceId: string | null; pricingKey?: string | null }): OperationPhotoTarget | null {
  if (line.serviceId) return { serviceId: line.serviceId };
  if (line.pricingKey) return { pricingKey: line.pricingKey };
  return null;
}

/** Les exemples d'une opération, dans leur ordre, limités à ce que la ligne peut encore recevoir. */
export function examplesFor(
  target: OperationPhotoTarget | null,
  library: readonly OperationPhotoView[],
  room = QUOTE_OPERATION_PHOTO_MAX_PER_LINE,
): OperationPhotoView[] {
  if (!target || room <= 0) return [];
  const personal = library
    .filter((photo) => ("serviceId" in target ? photo.serviceId === target.serviceId : photo.pricingKey === target.pricingKey))
    .sort((a, b) => a.position - b.position)
    .slice(0, room);
  if (personal.length || !("pricingKey" in target)) return personal;
  const fallback = defaultOperationPhoto(target.pricingKey);
  return fallback ? [fallback] : [];
}

export async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}
