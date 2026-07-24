// Small shared badge so every onboarding screen visually distinguishes
// detected-automatically / confirmed / not-found — an explicit requirement
// of the feature (never let a detected value look like a confirmed one).
export type DetectionState = "detected" | "confirmed" | "notFound";

const STYLES: Record<DetectionState, string> = {
  detected: "border-sky-300 bg-sky-50 text-sky-800",
  confirmed: "border-emerald-300 bg-emerald-50 text-emerald-800",
  notFound: "border-amber-300 bg-amber-50 text-amber-800",
};

const LABELS: Record<DetectionState, string> = {
  detected: "Détecté automatiquement",
  confirmed: "Confirmé",
  notFound: "Non trouvé",
};

export function DetectionBadge({ state }: { state: DetectionState }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${STYLES[state]}`}>
      {LABELS[state]}
    </span>
  );
}
