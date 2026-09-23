export const QUOTE_OPERATION_PHOTOS_BUCKET = "marketplace-quote-operation-photos";
export const QUOTE_OPERATION_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const QUOTE_OPERATION_PHOTO_MIME_TYPES = ["image/jpeg", "image/png"] as const;
export const QUOTE_OPERATION_PHOTO_MAX_PER_LINE = 6;

export type QuoteOperationPhotoMime = (typeof QUOTE_OPERATION_PHOTO_MIME_TYPES)[number];

export async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}
