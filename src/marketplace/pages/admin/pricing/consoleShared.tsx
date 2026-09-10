/**
 * Les pièces communes de la console de prix.
 *
 * Un outil interne, dense, lu sur un écran de bureau : des chiffres alignés,
 * des états écrits en toutes lettres, pas de couleurs qui parlent seules.
 * Une marge en alerte le dit (« Alerte »), elle ne se contente pas d'être rouge.
 */
import type { ReactNode } from "react";
import { money, percent } from "./consoleFormat";
import {
  MARGIN_STATUS_LABELS,
  type MarginAssessment,
  type MarginStatus,
} from "@/marketplace/pricing/margin";
import type { EvidenceAssessment } from "@/marketplace/pricing/pricebookEvidence";
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
        {money(margin.marginCents)} · {percent(margin.marginBps)}
      </span>
    </span>
  );
}

export function EvidenceNote({ evidence }: { evidence: EvidenceAssessment }) {
  return (
    <span className="text-xs" title={evidence.alerts.join("\n")}>
      <span className={evidence.level === "NONE" ? "text-muted-foreground" : ""}>
        {evidence.label}
      </span>
      {evidence.alerts.length > 0 && (
        <span className="ml-1 text-amber-800">
          · {evidence.alerts.length} alerte{evidence.alerts.length > 1 ? "s" : ""}
        </span>
      )}
    </span>
  );
}

/**
 * Où tombe notre prix TTC par rapport à ce que le web affiche.
 *
 * Une barre, pas un score : la fourchette affichée en gris, sa médiane en
 * trait fin, notre prix en repère plein. On voit d'un coup d'œil « au-dessus »,
 * « dedans » ou « en dessous », et c'est tout ce que ce repère peut dire.
 */
export function MarketBar({
  priceCents,
  lowCents,
  highCents,
  medianCents,
  title,
}: {
  priceCents: number | null;
  lowCents: number | null;
  highCents: number | null;
  medianCents: number | null;
  title?: string;
}) {
  if (lowCents === null || highCents === null)
    return <span className="text-xs text-muted-foreground">Aucun repère</span>;
  const values = [lowCents, highCents, ...(priceCents === null ? [] : [priceCents])];
  const min = Math.min(...values) * 0.9;
  const max = Math.max(...values) * 1.1;
  const position = (value: number) => `${((value - min) / (max - min)) * 100}%`;
  return (
    <span
      className="relative inline-block h-3 w-28 align-middle"
      title={title ?? `Web : ${money(lowCents)} – ${money(highCents)}`}
      aria-label={title ?? `Web : ${money(lowCents)} à ${money(highCents)}`}
      role="img"
    >
      <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
      <span
        className="absolute top-0.5 h-2 rounded-[1px] bg-muted-foreground/25"
        style={{
          left: position(lowCents),
          width: `calc(${position(highCents)} - ${position(lowCents)})`,
        }}
      />
      {medianCents !== null && (
        <span
          className="absolute top-0 h-3 w-px bg-muted-foreground"
          style={{ left: position(medianCents) }}
        />
      )}
      {priceCents !== null && (
        <span
          className="absolute top-0 h-3 w-1 -translate-x-1/2 rounded-[1px] bg-foreground"
          style={{ left: position(priceCents) }}
        />
      )}
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
