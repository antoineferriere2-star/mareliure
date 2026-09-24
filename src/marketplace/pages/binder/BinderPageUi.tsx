import type { ReactNode } from "react";
import { ArrowRight, LoaderCircle, RefreshCw } from "lucide-react";

export function BinderPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-[#cfc5b6] pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#7a2230]">{eyebrow}</p>}
        <h1 className="mt-1 font-editorial text-3xl font-normal leading-tight tracking-[-0.02em] text-[#1f1812] sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-xl text-sm leading-6 text-[#685d51]">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function BinderSectionTitle({
  id,
  title,
  detail,
  count,
}: {
  /** Pour qu'une `<section aria-labelledby>` trouve bien son titre. */
  id?: string;
  title: string;
  detail?: string;
  count?: number;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <div>
        <h2 id={id} className="font-editorial text-xl font-normal tracking-[-0.01em] text-[#1f1812]">{title}</h2>
        {detail && <p className="mt-1 text-sm text-[#74695d]">{detail}</p>}
      </div>
      {typeof count === "number" && <span className="text-xs font-semibold tabular-nums text-[#74695d]">{count}</span>}
    </div>
  );
}

export function BinderEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="border border-dashed border-[#bdb1a1] bg-[#fffdf8] px-6 py-12 text-center">
      <p className="font-editorial text-xl text-[#1f1812]">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#74695d]">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function BinderLoading({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-32 items-center justify-center gap-3 border border-[#d8d0c4] bg-[#fffdf8] text-sm text-[#685d51]">
      <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

/** Une source n'a pas répondu : on le dit, on propose de réessayer, le reste de l'écran continue de servir. */
export function BinderRetryNote({ children, onRetry, retrying }: { children: ReactNode; onRetry: () => void; retrying?: boolean }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-[#9a3412] bg-[#fdf1ea] px-4 py-3 text-sm text-[#5a1f0c]">
      <p className="min-w-0 flex-1 leading-6">{children}</p>
      <button type="button" onClick={onRetry} disabled={retrying} className="inline-flex min-h-11 items-center gap-2 rounded-sm px-2 font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a2230]/50 disabled:opacity-60">
        <RefreshCw aria-hidden="true" className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
        {retrying ? "Nouvel essai…" : "Réessayer"}
      </button>
    </div>
  );
}

export function BinderInlineAction({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#5f1b27] underline decoration-[#7a2230]/30 underline-offset-4">
      {children}
      <ArrowRight aria-hidden="true" className="h-4 w-4" />
    </span>
  );
}
