/** Nombre de composantes d'un JPEG, lu dans son en-tête ; `null` si l'en-tête est illisible. */
export function jpegComponents(bytes: Uint8Array): number | null {
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return bytes[at + 9];
    at += 2 + ((bytes[at + 2] << 8) | bytes[at + 3]);
  }
  return null;
}

/** Un JPEG CMJN ne peut pas entrer dans un document PDF/A : il faut le refuser avant de le ranger. */
export const isCmykJpeg = (bytes: Uint8Array) => jpegComponents(bytes) === 4;

export const IMAGE_CMYK_MESSAGE = "Cette image est en CMJN, un format réservé à l'impression. Enregistrez-la en RVB, puis ajoutez-la de nouveau.";

/** Le refus CMJN dit quoi faire ; toute autre erreur garde le message de l'écran. */
export const imageUploadProblem = (error: unknown, fallback: string) =>
  error instanceof Error && error.message === IMAGE_CMYK_MESSAGE ? IMAGE_CMYK_MESSAGE : fallback;
