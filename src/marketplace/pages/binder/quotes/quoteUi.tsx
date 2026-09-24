/**
 * Les briques que partagent les écrans devis/factures du relieur : un statut
 * lisible, un champ d'argent qui se laisse taper (« 280,5 »), une note d'erreur
 * écrite pour le relieur — jamais un message technique du serveur.
 */
import { useEffect, useState, type ReactNode } from "react";
import {
  effectiveStatus,
  QUOTE_STATUS_LABELS,
  todayInParis,
  type QuoteStatus,
} from "@/marketplace/quotes/quoteStatus";
import { centsToEuroInput, parseEurosToCents, parseQuantity } from "@/marketplace/quotes/quoteFormat";

export const FIELD =
  "h-11 w-full rounded-sm border border-[#cfc5b6] bg-[#fffdf8] px-3 text-sm text-[#241a12] placeholder:text-[#8b8175] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a2230]/45";
export const CARD = "rounded-sm border border-[#d8d0c4] bg-[#fffdf8] p-4 sm:p-5";
export const PRIMARY_BUTTON =
  "inline-flex h-11 items-center justify-center rounded-sm bg-[#241a12] px-5 text-sm font-semibold text-[#fffdf8] transition hover:bg-[#4b3829] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a2230]/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
export const SECONDARY_BUTTON =
  "inline-flex h-11 items-center justify-center rounded-sm border border-[#bdb1a1] bg-transparent px-4 text-sm font-semibold text-[#34281f] transition hover:border-[#796b5d] hover:bg-[#f3eee5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a2230]/45 disabled:cursor-not-allowed disabled:opacity-50";

const TONES: Record<QuoteStatus, string> = {
  draft: "border-border bg-muted text-foreground",
  sent: "border-sky-300 bg-sky-50 text-sky-900",
  accepted: "border-emerald-300 bg-emerald-50 text-emerald-900",
  refused: "border-rose-300 bg-rose-50 text-rose-900",
  expired: "border-border bg-transparent text-muted-foreground",
  invoiced: "border-foreground bg-foreground text-background",
};

/** Le statut d'un devis : un « brouillon » ou « envoyé » dont la validité est dépassée se lit « Expiré ». */
export function QuoteStatusBadge({ status, validUntil }: { status: QuoteStatus; validUntil?: string | null }) {
  const shown = validUntil ? effectiveStatus(status, validUntil, todayInParis()) : status;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONES[shown]}`}>
      {QUOTE_STATUS_LABELS[shown]}
    </span>
  );
}

export const PAYMENT_LABELS = { unpaid: "Non payée", deposit_paid: "Acompte payé", paid: "Payée", credited: "Annulée par avoir" } as const;

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Un champ d'argent en euros. Il garde ce que le relieur tape (« 28 », « 280, »)
 * et ne réécrit le texte que si la valeur change de l'extérieur — sinon on ne
 * pourrait jamais taper une virgule.
 */
export function MoneyInput({
  cents,
  onChange,
  id,
  label,
  className = FIELD,
  invalid,
  blankWhenZero = false,
  onCommit,
}: {
  cents: number;
  onChange: (cents: number) => void;
  id: string;
  label: string;
  className?: string;
  invalid?: boolean;
  blankWhenZero?: boolean;
  /** Appelé quand le relieur QUITTE le champ (un prix saisi puis abandonné doit s'enregistrer). */
  onCommit?: () => void;
}) {
  const shown = (value: number) => blankWhenZero && value === 0 ? "" : centsToEuroInput(value);
  const [text, setText] = useState(shown(cents));
  useEffect(() => {
    if (parseEurosToCents(text) !== cents && !(blankWhenZero && cents === 0 && text === "")) setText(shown(cents));
    // Seul un changement extérieur de `cents` resynchronise le texte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cents]);
  return (
    <input
      id={id}
      aria-label={label}
      inputMode="decimal"
      autoComplete="off"
      className={`${className} text-right tabular-nums ${invalid ? "border-destructive" : ""}`}
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        const parsed = parseEurosToCents(event.target.value);
        if (parsed !== null) onChange(parsed);
      }}
      onBlur={() => {
        setText(shown(cents));
        onCommit?.();
      }}
    />
  );
}

export function QuantityInput({
  value,
  onChange,
  id,
  label,
  className = FIELD,
}: {
  value: number;
  onChange: (value: number) => void;
  id: string;
  label: string;
  className?: string;
}) {
  const [text, setText] = useState(String(value).replace(".", ","));
  useEffect(() => {
    if (parseQuantity(text) !== value) setText(String(value).replace(".", ","));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      id={id}
      aria-label={label}
      inputMode="decimal"
      autoComplete="off"
      className={`${className} text-center tabular-nums`}
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        const parsed = parseQuantity(event.target.value);
        if (parsed !== null) onChange(parsed);
      }}
      onBlur={() => setText(String(value).replace(".", ","))}
    />
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  );
}
