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
  return library
    .filter((photo) => ("serviceId" in target ? photo.serviceId === target.serviceId : photo.pricingKey === target.pricingKey))
    .sort((a, b) => a.position - b.position)
    .slice(0, room);
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
