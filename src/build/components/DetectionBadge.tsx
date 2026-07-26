// Small shared badge distinguishing detected-automatically / confirmed /
// not-found — used by the onboarding wizard (admin) and the
// inspiration_photo field (public runtime), so it lives outside both
// pages/admin and pages/public. Never let a detected value look like a
// confirmed one — that distinction is a hard requirement in both places.
export type DetectionState = "detected" | "confirmed" | "notFound";

const STYLES: Record<DetectionState, string> = {
  detected: "border-sky-300 bg-sky-50 text-sky-800",
  confirmed: "border-emerald-300 bg-emerald-50 text-emerald-800",
  notFound: "border-amber-300 bg-amber-50 text-amber-800",
};

// English defaults for the public runtime; the French admin onboarding
// wizard overrides these via the `labels` prop to keep its UI unchanged.
const DEFAULT_LABELS: Record<DetectionState, string> = {
  detected: "Detected from the provided information",
  confirmed: "Confirmed",
  notFound: "Not detected",
};

export function DetectionBadge({
  state,
  labels,
}: {
  state: DetectionState;
  labels?: Partial<Record<DetectionState, string>>;
}) {
  const label = labels?.[state] ?? DEFAULT_LABELS[state];
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${STYLES[state]}`}
    >
      {label}
    </span>
  );
}
