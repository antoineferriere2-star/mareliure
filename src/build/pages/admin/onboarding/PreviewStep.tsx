import { useMemo } from "react";
import { FIELD_COMPONENTS } from "@/build/engine/fields";
import { computeVisibleSteps } from "@/build/engine/validation";
import type { PlaybookSchema } from "@/build/schema/playbook";
import type { MissionProposal } from "@/build/schema/missionProposal";

export function PreviewStep({
  schema,
  loading,
  missionName,
  playbookName,
  proposal,
  onBack,
  onContinue,
}: {
  schema: PlaybookSchema | null;
  loading: boolean;
  missionName: string;
  playbookName: string;
  proposal: MissionProposal;
  onBack: () => void;
  onContinue: () => void;
}) {
  const firstStep = useMemo(() => {
    if (!schema) return null;
    return computeVisibleSteps(schema, {})[0] ?? null;
  }, [schema]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Preview</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only preview of the first step the visitor will see.
        </p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading preview…</p>}

      {!loading && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6" style={proposal.brandColor ? { borderColor: proposal.brandColor } : undefined}>
            <div className="flex items-center gap-3">
              {proposal.logoUrl && <img src={proposal.logoUrl} alt="" className="h-8 w-8 rounded object-contain" />}
              <p className="text-sm font-semibold uppercase tracking-[0.16em]" style={{ color: proposal.brandColor ?? "#047857" }}>
                {playbookName}
              </p>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">
              {firstStep?.step.title ?? missionName}
            </h1>
            {proposal.intro && <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{proposal.intro}</p>}
          </div>
          <div className="pointer-events-none p-6 opacity-90">
            {firstStep ? (
              <div className="grid gap-6">
                {firstStep.visibleFields
                  .filter((field) => !proposal.hideOptionalFields || field.desirability !== "optional")
                  .map((field) => {
                    const FieldComponent = FIELD_COMPONENTS[field.type];
                    return <FieldComponent key={field.key} field={field} value={undefined} onChange={() => {}} />;
                  })}
              </div>
            ) : (
              <p className="text-sm text-slate-600">This Playbook doesn't have any questions yet.</p>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
        >
          Retour
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={loading || !schema}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Continue to publishing
        </button>
      </div>
    </div>
  );
}
