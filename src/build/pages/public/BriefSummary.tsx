import { ShieldCheck, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { ProjectBrief } from "@/build/schema/brief";

export function BriefSummary({ brief }: { brief: ProjectBrief }) {
  const confirmed = brief.confirmedInformation.slice(0, 4);
  const constraints = brief.constraints.slice(0, 3);
  const missing = brief.missingInformation.slice(0, 3);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
            {brief.status}
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-normal text-slate-950">
            Example Project Brief
          </h3>
        </div>
        <ShieldCheck className="h-6 w-6 text-emerald-700" aria-hidden="true" />
      </div>

      <div className="mt-5 space-y-4">
        <Block title="Project summary">
          <p className="text-[15px] leading-6 text-slate-700">{brief.projectSummary}</p>
        </Block>

        <Block title="Confirmed details">
          <ul className="space-y-1.5 text-[15px] leading-6 text-slate-700">
            {confirmed.map((line) => (
              <li key={line.label}>
                <span className="font-medium text-slate-950">{line.label}:</span> {line.value}
              </li>
            ))}
          </ul>
        </Block>

        <Block title="Constraints">
          <ul className="space-y-1.5 text-[15px] leading-6 text-slate-700">
            {constraints.length === 0 ? (
              <li className="text-slate-500">None flagged.</li>
            ) : (
              constraints.map((line) => (
                <li key={line.label}>
                  <span className="font-medium text-slate-950">{line.label}:</span> {line.value}
                </li>
              ))
            )}
          </ul>
        </Block>

        <Block title="Missing information">
          <ul className="space-y-1.5 text-[15px] leading-6 text-slate-700">
            {missing.length === 0 ? (
              <li className="text-slate-500">Nothing critical missing.</li>
            ) : (
              missing.map((line) => (
                <li key={line.label}>
                  <span className="font-medium text-slate-950">{line.label}:</span> {line.value}
                </li>
              ))
            )}
          </ul>
        </Block>

        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
            Suggested next action
          </p>
          <p className="mt-2 text-[15px] font-semibold leading-6 text-emerald-950">
            {brief.suggestedNextAction.label}
          </p>
          <p className="mt-1 text-[15px] leading-6 text-emerald-900">
            {brief.suggestedNextAction.value}
          </p>
        </div>
      </div>

      <Link
        to="/example-project-brief"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
      >
        View the full example brief <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {title}
      </h4>
      <div className="mt-2">{children}</div>
    </section>
  );
}
