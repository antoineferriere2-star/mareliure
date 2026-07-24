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
