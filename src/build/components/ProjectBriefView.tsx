// Readable rendering of a ProjectBrief (Dossier Commercial content) — used by
// the Espace Client portal so a client never sees the raw JSON structure.
// The portal is English (US) throughout, so every label here is English.
import type { BriefLine, ProjectBrief } from "@/build/schema/brief";
import { humanizeRawValue } from "@/build/dossiers/dossierDisplay";

const CONFIDENCE_LABELS: Record<ProjectBrief["confidence"]["label"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const SOURCE_LABELS: Record<BriefLine["source"], string> = {
  visitor_answer: "Customer provided",
  calculated_value: "Calculated",
  deterministic_rule: "Playbook rule",
  assumed_default: "Assumed default",
  image_hypothesis: "AI hypothesis (photo, unconfirmed)",
};

function LineList({ lines }: { lines: BriefLine[] }) {
  if (lines.length === 0) return <p className="text-xs text-muted-foreground">—</p>;
  return (
    <dl className="space-y-2">
      {lines.map((line, i) => (
        <div key={`${line.label}-${i}`} className="text-sm">
          <dt className="text-xs font-medium text-muted-foreground">
            {humanizeRawValue(line.label)}
          </dt>
          <dd className="text-foreground">
            {humanizeRawValue(line.value)}{" "}
            <span className="text-[10px] uppercase text-muted-foreground">
              · {SOURCE_LABELS[line.source]}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ProjectBriefView({ brief }: { brief: ProjectBrief }) {
  return (
    <div className="space-y-5">
      <section>
        <h3 className="text-sm font-semibold text-foreground">Project summary</h3>
        <p className="mt-1 text-sm text-foreground">{humanizeRawValue(brief.projectSummary)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Confidence: {CONFIDENCE_LABELS[brief.confidence.label]}
          {brief.confidence.reasons.length > 0 ? ` — ${brief.confidence.reasons.join(", ")}` : ""}
        </p>
      </section>

      {brief.confirmedInformation.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-foreground">Confirmed information</h3>
          <div className="mt-2">
            <LineList lines={brief.confirmedInformation} />
          </div>
        </section>
      )}

      {brief.budgetAndTiming.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-foreground">Budget and timeline</h3>
          <div className="mt-2">
            <LineList lines={brief.budgetAndTiming} />
          </div>
        </section>
      )}

      {brief.constraints.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-foreground">Constraints</h3>
          <div className="mt-2">
            <LineList lines={brief.constraints} />
          </div>
        </section>
      )}

      {brief.assumptionsAndCalculated.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-foreground">Assumptions and calculations</h3>
          <div className="mt-2">
            <LineList lines={brief.assumptionsAndCalculated} />
          </div>
        </section>
      )}

      {brief.missingInformation.length > 0 && (
        <section className="rounded-md border border-amber-300 bg-amber-50 p-3">
          <h3 className="text-sm font-semibold text-amber-900">To confirm with the customer</h3>
          <div className="mt-2">
            <LineList lines={brief.missingInformation} />
          </div>
        </section>
      )}

      <section className="rounded-md border border-primary/30 bg-primary/5 p-3">
        <h3 className="text-sm font-semibold text-foreground">Suggested next step</h3>
        <p className="mt-1 text-sm text-foreground">{brief.suggestedNextAction.value}</p>
      </section>
    </div>
  );
}
