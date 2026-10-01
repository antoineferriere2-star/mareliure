import { useFineBinderyWorkspace } from "@/marketplace/i18n/FineBinderyWorkspaceContext";
import { NO_WORKSHOP_COPY } from "@/marketplace/i18n/noWorkshopCopy";

/** Refus d'un compte sans atelier : traduit, avec une orientation propre à la marque (audit #53, C4). */
export function NoWorkshopNotice() {
  const { isFineBindery, locale } = useFineBinderyWorkspace();
  const copy = NO_WORKSHOP_COPY[locale];
  return (
    <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
      <p className="font-semibold">{copy.title}</p>
      <p className="mt-1">{copy.body}</p>
      <a href={isFineBindery ? `/${locale}/professionals` : "/partenaires-relieurs"} className="mt-2 inline-block underline">{copy.link}</a>
    </div>
  );
}
