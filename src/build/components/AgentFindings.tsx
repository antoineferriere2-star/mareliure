// Shared rendering for AI agent output shaped as {label, detail, severity}
// findings — used by the Dossier AI Agents (dossiers.$id.tsx) and the public
// request site audit (requests.$id.tsx). Both agent pipelines emit this
// exact shape (src/build/ai/schema.ts's Finding / src/build/ai/siteAudit.ts's
// SiteAuditFinding), so the same badge/list renders either one.
import type { AgentResult, Finding, FindingSeverity } from "@/build/ai/schema";

const SEVERITY_STYLES: Record<FindingSeverity, string> = {
  info: "border-sky-300 bg-sky-50 text-sky-800",
  warning: "border-amber-300 bg-amber-50 text-amber-800",
  critical: "border-red-300 bg-red-50 text-red-800",
};

export function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${SEVERITY_STYLES[severity]}`}>
      {severity}
    </span>
  );
}

export function FindingsList({ findings }: { findings: { label: string; detail: string; severity: FindingSeverity }[] }) {
  if (findings.length === 0) return null;
  return (
    <ul className="mt-2 space-y-2">
      {findings.map((f, i) => (
        <li key={i} className="flex flex-col gap-1 rounded border border-border p-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{f.label}</span>
            <SeverityBadge severity={f.severity} />
          </div>
          <p className="text-muted-foreground">{f.detail}</p>
        </li>
      ))}
    </ul>
  );
}

export function AgentBlock({
  title,
  result,
  extra,
}: {
  title: string;
  result: AgentResult<{ summary: string; findings: Finding[] }>;
  extra?: string[];
}) {
  if (result.status === "error") {
    return (
      <div className="rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-3">
        <h3 className="text-xs font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-xs text-destructive">Échec de l'analyse : {result.error}</p>
      </div>
    );
  }
  const data = result.data;
  if (!data) return null;
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <h3 className="text-xs font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-foreground">{data.summary}</p>
      <FindingsList findings={data.findings} />
      {extra && extra.length > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">Notes utilisées : {extra.join(", ")}</p>
      )}
    </div>
  );
}
