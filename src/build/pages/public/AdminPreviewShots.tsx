/**
 * Marketing-only mirrors of the real admin Missions/Dossiers list pages
 * (routes/_authenticated/build/{missions,dossiers}.index.tsx). Those real
 * pages are wired to an authenticated server fetch, so they can't be
 * rendered directly on a public page — these components reproduce the same
 * columns, badge classes and structure, fed with static demo rows instead.
 *
 * The confidence + missing-information-count column on the Dossiers preview
 * is a deliberate addition, not present on the real list today: both values
 * already exist on every generated Project Brief, this just surfaces them
 * one level higher than the current admin UI does.
 */
import type { DemoMissionRow, DemoDossierRow } from "@/build/content/demoProductData";

const MISSION_STATUS_STYLES: Record<DemoMissionRow["status"], string> = {
  draft: "border-slate-300 bg-slate-100 text-slate-700",
  active: "border-emerald-300 bg-emerald-50 text-emerald-800",
  paused: "border-amber-300 bg-amber-50 text-amber-800",
  archived: "border-slate-300 bg-slate-50 text-slate-500",
};

function MissionStatusBadge({ status }: { status: DemoMissionRow["status"] }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${MISSION_STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export function MissionsListPreview({ rows }: { rows: DemoMissionRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2 text-left">Name</th>
            <th className="px-4 py-2 text-left">Status</th>
            <th className="px-4 py-2 text-left">Playbook</th>
            <th className="px-4 py-2 text-left">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-b border-slate-100 last:border-b-0">
              <td className="px-4 py-3">
                <div className="font-medium text-slate-950">{m.name}</div>
                {m.objective && <div className="text-xs text-slate-500">{m.objective}</div>}
              </td>
              <td className="px-4 py-3">
                <MissionStatusBadge status={m.status} />
              </td>
              <td className="px-4 py-3 text-slate-600">{m.playbook_name ?? "—"}</td>
              <td className="px-4 py-3 text-xs text-slate-500">
                {new Date(m.created_at).toLocaleDateString("en-US")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CONFIDENCE_STYLES: Record<DemoDossierRow["confidence"], string> = {
  high: "border-emerald-300 bg-emerald-50 text-emerald-800",
  medium: "border-amber-300 bg-amber-50 text-amber-800",
  low: "border-rose-300 bg-rose-50 text-rose-800",
};

export function DossiersListPreview({ rows }: { rows: DemoDossierRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2 text-left">Summary</th>
            <th className="px-4 py-2 text-left">Status</th>
            <th className="px-4 py-2 text-left">Confidence</th>
            <th className="px-4 py-2 text-left">Mission</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-b border-slate-100 last:border-b-0">
              <td className="px-4 py-3 font-medium text-slate-950">{d.summary}</td>
              <td className="px-4 py-3">
                <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[10px] uppercase text-slate-600">
                  {d.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${CONFIDENCE_STYLES[d.confidence]}`}
                >
                  {d.confidence}
                </span>
                <span className="ml-2 text-xs text-slate-500">{d.missing_count} missing</span>
              </td>
              <td className="px-4 py-3 text-slate-600">{d.mission_name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
