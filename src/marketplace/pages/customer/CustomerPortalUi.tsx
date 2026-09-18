/**
 * Les briques que la liste et le détail partagent : un statut, un chargement,
 * une erreur, un état vide. Un seul vocabulaire visuel, pour que l'espace
 * client ne change pas de langue d'un écran à l'autre.
 *
 * Aucun message d'erreur du serveur n'est jamais affiché ici : ni trace, ni
 * texte Supabase ou Stripe, ni message d'API brut. Le client lit une phrase
 * écrite pour lui et un bouton pour réessayer.
 */
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { CustomerCopy, CustomerStatus, CustomerStatusTone } from "@/marketplace/customer/customerPresentation";

const TONE_CLASSES: Record<CustomerStatusTone, string> = {
  neutral: "border-[#3b2a1d]/20 bg-[#3b2a1d]/[0.05] text-[#3b2a1d]",
  progress: "border-[#a98c55]/50 bg-[#a98c55]/15 text-[#5b4520]",
  action: "border-[#8a2e1f]/40 bg-[#8a2e1f]/10 text-[#7a2a1c]",
  done: "border-[#3f5d3a]/40 bg-[#3f5d3a]/10 text-[#2f4a2b]",
  muted: "border-[#3b2a1d]/15 bg-transparent text-[#6b5847]",
};

/** Le statut, en mots. Le texte porte l'information : la couleur ne fait que l'appuyer. */
export function StatusBadge({ status }: { status: CustomerStatus }) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-tight ${TONE_CLASSES[status.tone]}`}
    >
      {status.label}
    </span>
  );
}

export function PortalListSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-6">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-2/3" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-4 rounded-2xl border border-[#3b2a1d]/15 bg-[#fdfaf3] p-5">
            <Skeleton className="h-20 w-20 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-6 w-32 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PortalDetailSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-6">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-4 w-24" />
      <div className="space-y-3">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}

/** Une erreur écrite pour le client, avec un bouton pour réessayer. */
export function PortalError({
  message,
  retryLabel,
  onRetry,
  busy = false,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
  busy?: boolean;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-[#8a2e1f]/30 bg-[#fdfaf3] p-6 text-[#241a12]"
    >
      <p className="text-base">{message}</p>
      <Button className="mt-4" variant="outline" onClick={onRetry} disabled={busy}>
        {retryLabel}
      </Button>
    </div>
  );
}

export function PortalEmpty({ copy }: { copy: CustomerCopy }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#3b2a1d]/25 bg-[#fdfaf3] px-6 py-12 text-center">
      <h2 className="font-serif text-2xl text-[#241a12]">{copy.emptyTitle}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#4b3a2c]">{copy.emptyBody}</p>
      <Button asChild className="mt-6">
        <a href={copy.startProjectHref}>{copy.emptyCta}</a>
      </Button>
    </div>
  );
}
