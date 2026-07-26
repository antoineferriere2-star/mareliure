import { CheckCircle2, ShieldCheck, FileText } from "lucide-react";
import { SectionHeader } from "@/build/pages/public/BuildPublicShell";
import { BriefPreview } from "@/build/pages/public/BriefPreview";
import { demoJaneMillerBrief } from "@/build/content/demoProductData";

const HONEST_DISCOVERY_POINTS = [
  {
    icon: CheckCircle2,
    title: "Customers can answer approximately",
    text: "Ranges, 'not sure' and 'need to check' are first-class answers.",
  },
  {
    icon: ShieldCheck,
    title: "Missing information is clearly identified",
    text: "Gaps are flagged in the brief so sales can prepare the right questions.",
  },
  {
    icon: FileText,
    title: "Assumptions are never presented as facts",
    text: "Every line shows its source: customer answer, business rule, or calculated value.",
  },
];

function GenericFormMockup() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        Generic website form
      </p>
      <div className="mt-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500">Name</label>
          <div className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Jane Miller
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Email</label>
          <div className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            jane.miller@example.com
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Message</label>
          <div className="mt-1 min-h-24 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            "Hi, I'm looking to get a deck built at some point this year, not sure on budget yet.
            Let me know!"
          </div>
        </div>
      </div>
      <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
        No dimensions, no site conditions, no budget range, no timeline — the sales team starts from
        a blank slate.
      </p>
    </div>
  );
}

export function BeforeAfterSection() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Before / after"
          title="Same inquiry. A structured Project Brief instead of a blank message."
          description="The same visitor, guided by a Playbook instead of a single text box, produces a brief the sales team can act on immediately."
        />
        <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:items-start">
          <GenericFormMockup />
          <BriefPreview brief={demoJaneMillerBrief} compact />
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {HONEST_DISCOVERY_POINTS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <Icon className="h-5 w-5 text-emerald-700" />
              <h3 className="mt-3 text-sm font-semibold tracking-normal text-slate-950">{title}</h3>
              <p className="mt-1.5 text-[13px] leading-5 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
