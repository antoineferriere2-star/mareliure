/**
 * Les pièces communes de la grille tarifaire et du simulateur.
 *
 * Un outil interne, dense, lu sur un écran de bureau : des chiffres alignés,
 * des états écrits en toutes lettres, pas de couleurs qui parlent seules. Une
 * marge en alerte le dit (« Alerte »), elle ne se contente pas d'être rouge.
 */
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { money, percent } from "./consoleFormat";
import {
  MARGIN_STATUS_LABELS,
  type MarginAssessment,
  type MarginStatus,
} from "@/marketplace/pricing/margin";
import { PROVENANCE_LABELS, type PriceProvenance } from "@/marketplace/pricing/provenance";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** D'abord la grille, ensuite le simulateur : l'ordre dit à quoi sert l'écran. */
export function PricingTabs() {
  const tab =
    "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground [&.active]:bg-muted [&.active]:text-foreground";
  return (
    <nav aria-label="Tarifs" className="flex gap-1">
      <Link to="/marketplace/pricing" activeOptions={{ exact: true }} className={tab}>
        Grille tarifaire
      </Link>
      <Link to="/marketplace/pricing/simulator" className={tab}>
        Simulateur
      </Link>
    </nav>
  );
}

const MARGIN_TONE: Record<MarginStatus, string> = {
  OK: "border-emerald-700/30 text-emerald-800",
  ATTENTION: "border-amber-600/40 bg-amber-50 text-amber-900",
  ALERTE: "border-red-700/40 bg-red-50 text-red-800",
};

export function MarginBadge({ margin }: { margin: MarginAssessment | null }) {
  if (!margin) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-xs ${MARGIN_TONE[margin.status]}`}
      title={margin.reasons.join(" ") || "Marge au niveau de la cible."}
    >
      <strong className="font-semibold">{MARGIN_STATUS_LABELS[margin.status]}</strong>
      <span className="tabular-nums">
        {money(margin.marginCents)} HT · {percent(margin.marginBps)}
      </span>
    </span>
  );
}

const PROVENANCE_TONE: Record<PriceProvenance, string> = {
  WEB_REFERENCE_INITIAL: "border-amber-600/40 text-amber-900",
  ADMIN_VALIDATED: "border-emerald-700/30 text-emerald-800",
  HISTORICAL_TRANSACTION: "border-border text-muted-foreground",
  CASE_OVERRIDE: "border-sky-700/30 text-sky-900",
};

export function ProvenanceTag({ provenance }: { provenance: PriceProvenance }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-sm border px-1 text-[11px] leading-4 ${PROVENANCE_TONE[provenance]}`}
    >
      {PROVENANCE_LABELS[provenance]}
    </span>
  );
}

export function ViewSection({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  onConfirm,
  pending,
  disabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  disabled?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || disabled}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {pending ? "Enregistrement…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const inputClass =
  "h-8 w-full rounded-md border border-input bg-background px-2 text-sm tabular-nums";
export const selectClass = "h-8 rounded-md border border-input bg-background px-2 text-sm";
