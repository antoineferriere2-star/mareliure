/**
 * Visionneuse des photos d'un dossier : un clic sur une vignette l'ouvre en grand, les flèches
 * (boutons ou clavier) passent à la suivante, Échap ferme. Générique : elle ne reçoit que des
 * photos déjà signées et autorisées pour ce lecteur, et ne décide d'aucune divulgation.
 */
import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { CaseViewPhoto } from "@/marketplace/cases/dossierProjection";

type Locale = "fr-FR" | "en-US";

export function photoAlt(photo: CaseViewPhoto, index: number, en: boolean): string {
  return photo.caption ?? (en ? `Photo ${index + 1} of the book` : `Photo ${index + 1} de l'ouvrage`);
}

/** Index suivant ou précédent, en boucle. */
export function stepPhoto(current: number, delta: 1 | -1, count: number): number {
  if (count <= 0) return 0;
  return (current + delta + count) % count;
}

export function CasePhotoGallery({ photos, locale = "fr-FR" }: { photos: CaseViewPhoto[]; locale?: Locale }) {
  const en = locale === "en-US";
  const shown = photos.filter((photo): photo is CaseViewPhoto & { url: string } => Boolean(photo.url));
  const [open, setOpen] = useState<number | null>(null);
  const count = shown.length;
  const step = useCallback((delta: 1 | -1) => setOpen((i) => (i === null ? i : stepPhoto(i, delta, count))), [count]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step]);

  const current = open === null ? null : shown[open];
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {shown.map((photo, index) => (
          <li key={photo.url} className="overflow-hidden rounded-lg border border-[#3b2a1d]/15">
            <button
              type="button"
              onClick={() => setOpen(index)}
              className="block w-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7a2230]"
              aria-label={en ? `Enlarge photo ${index + 1}` : `Agrandir la photo ${index + 1}`}
            >
              <img
                src={photo.url}
                alt={photoAlt(photo, index, en)}
                className="aspect-square w-full object-cover transition-opacity hover:opacity-90"
                loading="lazy"
              />
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={current !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="max-w-[min(96vw,1400px)] gap-3 border-none bg-[#17110c] p-3 text-[#f5efe6] sm:p-4">
          {current && open !== null && (
            <>
              <DialogTitle className="pr-8 text-sm font-normal text-[#d9cfc2]">
                {en ? `Photo ${open + 1} of ${count}` : `Photo ${open + 1} sur ${count}`}
                {current.caption ? ` — ${current.caption}` : ""}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {en ? "Use the arrow keys to browse the photos." : "Les flèches du clavier font défiler les photos."}
              </DialogDescription>
              <div className="relative flex items-center justify-center">
                <img
                  src={current.url}
                  alt={photoAlt(current, open, en)}
                  className="max-h-[82vh] w-auto max-w-full rounded object-contain"
                />
                {count > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => step(-1)}
                      className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/55 px-3 py-2 text-2xl leading-none hover:bg-black/75"
                      aria-label={en ? "Previous photo" : "Photo précédente"}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => step(1)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/55 px-3 py-2 text-2xl leading-none hover:bg-black/75"
                      aria-label={en ? "Next photo" : "Photo suivante"}
                    >
                      ›
                    </button>
                  </>
                )}
              </div>
              <a
                href={current.url}
                target="_blank"
                rel="noreferrer"
                className="justify-self-end text-xs text-[#d9cfc2] underline"
              >
                {en ? "Open full size" : "Ouvrir en taille réelle"}
              </a>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
