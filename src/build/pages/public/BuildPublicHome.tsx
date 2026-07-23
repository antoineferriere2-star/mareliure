import { ArrowRight, CheckCircle2, FileText, Layers3, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BriefPreview } from "@/build/pages/public/BriefPreview";
import { defaultDeckBrief } from "@/build/pages/public/defaultDeckBrief";
import {
  BuildPublicShell,
  CheckItem,
  ComparisonRow,
  InfoPanel,
  ObjectCard,
  PublicCtaBand,
  SectionHeader,
  StepLine,
} from "@/build/pages/public/BuildPublicShell";

export function BuildPublicHome() {
  return (
    <BuildPublicShell>
      <main>
        <section className="overflow-hidden bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Private beta for US project-based businesses</p>
              <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-normal text-slate-950 md:text-6xl">
                Turn vague website inquiries into sales-ready project briefs.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                Métré Build helps project-based businesses collect the details, photos, constraints, budget and timing their sales teams need before the first call.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="/demo/deck-project">
                  <Button size="lg">
                    Try the Deck Project Demo<ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
                <a href="/free-inquiry-audit">
                  <Button size="lg" variant="outline">Request a Free Inquiry Audit</Button>
                </a>
              </div>
              <p className="mt-5 text-sm font-medium text-slate-500">No credit card. No public setup required. Built for early pilot partners.</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <img src="/og-image.png" alt="Métré Build product preview" className="h-52 w-full rounded-md object-cover" />
              <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">Example output</p>
                <h2 className="mt-2 text-xl font-semibold tracking-normal">Deck replacement project brief</h2>
                <div className="mt-4 grid gap-2 text-sm text-slate-700">
                  {[
                    "Confirmed scope: elevated composite replacement",
                    "Constraints: stairs, backyard access, existing structure",
                    "Missing: permit review, exact structural condition",
                    "Next action: schedule site visit",
                  ].map((item) => (
                    <div key={item} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              title="Your sales team should not have to rediscover the entire project on the first call."
              description="Most contact forms collect identity. They rarely collect the project."
            />
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <InfoPanel title="Classic forms often capture" items={["Name", "Email", "Phone number", "A vague free-text message"]} />
              <InfoPanel title="They usually miss" items={["Dimensions", "Photos", "Budget", "Timeline", "Constraints", "Missing information", "Next commercial action"]} />
            </div>
          </div>
        </section>

        <section className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Product"
              title="Not a generic form builder."
              description="Métré Build uses industry Playbooks to guide prospects and turn incomplete inquiries into structured, actionable project briefs."
            />
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <ObjectCard icon={Layers3} title="Playbook" text="A ready-to-use qualification method for a specific project type." />
              <ObjectCard icon={Sparkles} title="Project Mission" text="The guided experience completed by the website visitor." />
              <ObjectCard icon={FileText} title="Project Brief" text="The structured output received by the business." />
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader eyebrow="How it works" title="A simple path from inquiry to commercial context." />
            <div className="mt-8 grid gap-3 md:grid-cols-4">
              {["Choose a Playbook", "Customize the project journey", "Add it to your website", "Receive structured project briefs"].map((step, index) => (
                <StepLine
                  key={step}
                  index={index + 1}
                  title={step}
                  text={[
                    "Start with project-specific qualification logic.",
                    "Tune the guided journey for your process.",
                    "Embed the Mission where inquiries already happen.",
                    "Review a structured brief before the first call.",
                  ][index]}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[420px_1fr]">
            <SectionHeader
              eyebrow="Deck builders"
              title="Qualify deck projects before the first sales call."
              description="The Deck Playbook asks for the details that usually get rediscovered later."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Project type",
                "Approximate dimensions",
                "Current site conditions",
                "Access constraints",
                "Photos",
                "Budget range",
                "Project timing",
                "Location",
                "Contact details",
                "Missing information",
              ].map((item) => (
                <CheckItem key={item}>{item}</CheckItem>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_460px] lg:items-start">
            <SectionHeader
              eyebrow="Example Project Brief"
              title="The output is organized for sales, not just storage."
              description="Facts, missing details and suggested next action are separated so the first follow-up starts with context."
            />
            <BriefPreview brief={defaultDeckBrief} compact />
          </div>
        </section>

        <section className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader eyebrow="Difference" title="Contact form vs Métré Build" />
            <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              {[
                ["Collects contact details", "Collects the project"],
                ["Same questions for everyone", "Guided project-specific logic"],
                ["Free-text message", "Structured project brief"],
                ["No coherence checks", "Flags gaps and inconsistencies"],
                ["Requires rediscovery", "Prepares the first sales call"],
              ].map(([classic, build]) => (
                <ComparisonRow key={classic} classic={classic} build={build} />
              ))}
            </div>
          </div>
        </section>

        <PublicCtaBand />
      </main>
    </BuildPublicShell>
  );
}
