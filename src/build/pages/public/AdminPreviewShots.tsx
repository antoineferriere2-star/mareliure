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
import { publicCopy, usePublicLocale } from "@/build/pages/public/publicLocaleContext";

const MISSION_STATUS_STYLES: Record<DemoMissionRow["status"], string> = {
  draft: "border-slate-300 bg-slate-100 text-slate-700",
  active: "border-emerald-300 bg-emerald-50 text-emerald-800",
  paused: "border-amber-300 bg-amber-50 text-amber-800",
  archived: "border-slate-300 bg-slate-50 text-slate-500",
};

function MissionStatusBadge({ status }: { status: DemoMissionRow["status"] }) {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${MISSION_STATUS_STYLES[status]}`}
    >
      {copy(status)}
    </span>
  );
}

export function MissionsListPreview({ rows }: { rows: DemoMissionRow[] }) {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {/* Below 640px: stacked cards, never a horizontally-scrolling table. */}
      <div className="divide-y divide-slate-100 sm:hidden">
        {rows.map((m) => (
          <div key={m.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-slate-950">{copy(m.name)}</div>
              <MissionStatusBadge status={m.status} />
            </div>
            {m.objective && <div className="mt-1 text-xs text-slate-500">{copy(m.objective)}</div>}
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{m.playbook_name ? copy(m.playbook_name) : "—"}</span>
              <span>{new Date(m.created_at).toLocaleDateString(locale)}</span>
            </div>
          </div>
        ))}
      </div>
      <table className="hidden w-full text-sm sm:table">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2 text-left">{copy("Name")}</th>
            <th className="px-4 py-2 text-left">{copy("Status")}</th>
            <th className="px-4 py-2 text-left">{copy("Playbook")}</th>
            <th className="px-4 py-2 text-left">{copy("Created")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-b border-slate-100 last:border-b-0">
              <td className="px-4 py-3">
                <div className="font-medium text-slate-950">{copy(m.name)}</div>
                {m.objective && <div className="text-xs text-slate-500">{copy(m.objective)}</div>}
              </td>
              <td className="px-4 py-3">
                <MissionStatusBadge status={m.status} />
              </td>
              <td className="px-4 py-3 text-slate-600">
                {m.playbook_name ? copy(m.playbook_name) : "—"}
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">
                {new Date(m.created_at).toLocaleDateString(locale)}
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

// Internal commercial_status values (French, matching the real domain data) are
// never shown raw on the public page — this maps them to public-facing English labels.
const DOSSIER_STATUS_LABELS: Record<string, string> = {
  nouveau: "New",
  contacte: "Contacted",
  devise: "Quoted",
  gagne: "Won",
  perdu: "Lost",
};

export function DossiersListPreview({ rows }: { rows: DemoDossierRow[] }) {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {/* Below 640px: stacked cards, never a horizontally-scrolling table. */}
      <div className="divide-y divide-slate-100 sm:hidden">
        {rows.map((d) => (
          <div key={d.id} className="p-4">
            <div className="font-medium text-slate-950">{copy(d.summary)}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[10px] uppercase text-slate-600">
                {copy(DOSSIER_STATUS_LABELS[d.status] ?? d.status)}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${CONFIDENCE_STYLES[d.confidence]}`}
              >
                {copy(d.confidence)}
              </span>
              <span className="text-xs text-slate-500">
                {d.missing_count} {copy("missing")}
              </span>
            </div>
            <div className="mt-2 text-xs text-slate-500">{copy(d.mission_name)}</div>
          </div>
        ))}
      </div>
      <table className="hidden w-full text-sm sm:table">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2 text-left">{copy("Summary")}</th>
            <th className="px-4 py-2 text-left">{copy("Status")}</th>
            <th className="px-4 py-2 text-left">{copy("Confidence")}</th>
            <th className="px-4 py-2 text-left">{copy("Project Intake")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-b border-slate-100 last:border-b-0">
              <td className="px-4 py-3 font-medium text-slate-950">{copy(d.summary)}</td>
              <td className="px-4 py-3">
                <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[10px] uppercase text-slate-600">
                  {copy(DOSSIER_STATUS_LABELS[d.status] ?? d.status)}
                </span>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${CONFIDENCE_STYLES[d.confidence]}`}
                >
                  {copy(d.confidence)}
                </span>
                <span className="ml-2 text-xs text-slate-500">
                  {d.missing_count} {copy("missing")}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600">{copy(d.mission_name)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
