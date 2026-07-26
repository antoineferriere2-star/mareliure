import { DetectionBadge, type DetectionState } from "@/build/components/DetectionBadge";

/**
 * Shared "confirm a detected value, or correct it" interaction, used for
 * both the business-type and product steps of the onboarding wizard — the
 * pattern is identical (candidates the client can pick from, plus a free
 * text override that always wins if filled in), only the copy differs.
 *
 * Reused as-is on the public marketing page (InsideMetreBuildSection) with
 * English defaults; the real French admin onboarding wizard
 * (routes/_authenticated/build/onboarding.tsx) overrides the chrome labels
 * below to keep its UI unchanged.
 */
export function SingleChoiceConfirmStep({
  title,
  description,
  candidates,
  value,
  onValueChange,
  onConfirm,
  onBack,
  noneDetectedMessage,
  confirmButtonLabel = "Confirm",
  backLabel = "Back",
  otherLabel = "Other — please specify",
  otherOnlyLabel = "Please specify",
  detectionLabels,
}: {
  title: string;
  description: string;
  candidates: string[];
  value: string;
  onValueChange: (value: string) => void;
  onConfirm: () => void;
  onBack: () => void;
  noneDetectedMessage: string;
  confirmButtonLabel?: string;
  backLabel?: string;
  otherLabel?: string;
  otherOnlyLabel?: string;
  detectionLabels?: Partial<Record<DetectionState, string>>;
}) {
  const customValue = candidates.includes(value) ? "" : value;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <DetectionBadge
          state={candidates.length > 0 ? "detected" : "notFound"}
          labels={detectionLabels}
        />
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>

      {candidates.length === 0 && <p className="text-sm text-amber-800">{noneDetectedMessage}</p>}

      <div className="space-y-2">
        {candidates.map((candidate) => (
          <label
            key={candidate}
            className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm ${
              value === candidate
                ? "border-emerald-500 bg-emerald-50"
                : "border-input bg-background"
            }`}
          >
            <input
              type="radio"
              checked={value === candidate}
              onChange={() => onValueChange(candidate)}
            />
            {candidate}
          </label>
        ))}
        <div>
          <label className="block text-xs font-medium text-muted-foreground">
            {candidates.length > 0 ? otherLabel : otherOnlyLabel}
          </label>
          <input
            value={customValue}
            onChange={(e) => onValueChange(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
        >
          {backLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={value.trim().length === 0}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {confirmButtonLabel}
        </button>
      </div>
    </div>
  );
}
