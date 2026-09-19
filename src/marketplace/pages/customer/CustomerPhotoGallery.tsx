/**
 * Les photos du livre, telles que le client les a envoyées.
 *
 * Elles viennent du serveur sous forme d'URL signées à durée limitée : les
 * buckets restent privés et ce composant ne connaît jamais un chemin de
 * stockage. Une URL expirée ou une image qui ne charge pas n'est pas un trou
 * dans la page — la vignette dit « photo indisponible » et le reste continue.
 */
import { useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ImageOff, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { CustomerCopy } from "@/marketplace/customer/customerPresentation";

export interface GalleryPhoto {
  url: string | null;
  caption: string | null;
}

/** Une image qui se charge, ou dit clairement qu'elle ne le peut pas. */
function LoadedImage({
  url,
  alt,
  className,
  fallbackLabel,
}: {
  url: string;
  alt: string;
  className: string;
  fallbackLabel: string;
}) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  if (state === "failed") {
    return (
      <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[#f3ece0] p-2 text-center text-xs text-[#6b5847]">
        <ImageOff aria-hidden="true" className="h-5 w-5" />
        {fallbackLabel}
      </span>
    );
  }
  return (
    <>
      {state === "loading" && <Skeleton className="absolute inset-0 rounded-none" />}
      <img
        src={url}
        alt={alt}
        loading="lazy"
        onLoad={() => setState("ready")}
        onError={() => setState("failed")}
        className={className}
      />
    </>
  );
}

export function CustomerPhotoGallery({ photos, copy }: { photos: readonly GalleryPhoto[]; copy: CustomerCopy }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // La vignette qui a ouvert l'agrandissement : le focus y revient à la fermeture,
  // y compris sur les navigateurs qui ne focalisent pas un bouton au clic (Safari).
  const opener = useRef<HTMLButtonElement | null>(null);
  if (photos.length === 0) return null;
  const open = openIndex === null ? null : photos[openIndex];

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, index) => (
          <li key={`${index}-${photo.url ?? "none"}`}>
            {photo.url ? (
              <button
                type="button"
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  setOpenIndex(index);
                }}
                aria-label={copy.photoOpen(index + 1)}
                className="relative block aspect-[4/3] w-full overflow-hidden rounded-lg border border-[#3b2a1d]/15 bg-[#f3ece0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b2a1d]/60 focus-visible:ring-offset-2"
              >
                <LoadedImage
                  url={photo.url}
                  alt={photo.caption ?? copy.photoAlt(index + 1)}
                  className="h-full w-full object-cover"
                  fallbackLabel={copy.photoUnavailable}
                />
              </button>
            ) : (
              <span className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-lg border border-[#3b2a1d]/15 bg-[#f3ece0] p-2 text-center text-xs text-[#6b5847]">
                <ImageOff aria-hidden="true" className="h-5 w-5" />
                {copy.photoUnavailable}
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* Radix directement, pas la boîte partagée : son bouton de fermeture est en
          anglais et son icône sombre disparaît sur ce fond noir. Ici : un bouton
          visible, de 44 px, dans la langue du client. */}
      <DialogPrimitive.Root open={open !== null} onOpenChange={(next) => !next && setOpenIndex(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,56rem)] -translate-x-1/2 -translate-y-1/2 focus:outline-none"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              opener.current?.focus();
            }}
          >
            <DialogPrimitive.Title className="sr-only">
              {open?.caption ?? copy.photoAlt((openIndex ?? 0) + 1)}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">{copy.photoClose}</DialogPrimitive.Description>
            {open?.url && (
              <img
                src={open.url}
                alt={open.caption ?? copy.photoAlt((openIndex ?? 0) + 1)}
                className="max-h-[85vh] w-full rounded-lg object-contain"
              />
            )}
            <DialogPrimitive.Close
              aria-label={copy.photoClose}
              className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-[#fdfaf3] text-[#241a12] shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

/** La photo principale, en tête de page : la première qui charge, sinon rien. */
export function CoverPhoto({ photo, alt }: { photo: GalleryPhoto | undefined; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!photo?.url || failed) return null;
  return (
    <img
      src={photo.url}
      alt={alt}
      onError={() => setFailed(true)}
      className="h-24 w-24 shrink-0 rounded-xl border border-[#3b2a1d]/15 object-cover sm:h-28 sm:w-28"
    />
  );
}
