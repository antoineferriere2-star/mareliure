import { ArrowRight, CheckCircle2, FileText, Layers3, Sparkles, Link2, ShieldCheck, HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BriefSummary } from "@/build/pages/public/BriefSummary";
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
        {/* HERO */}
        <section className="overflow-hidden bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Private beta for US project-based businesses
              </p>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl md:text-6xl">
                Turn vague website inquiries into sales-ready project briefs.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
                Métré Build helps project-based businesses collect the details, photos, constraints, budget and timing their sales teams need before the first call.
              </p>
              <p className="mt-4 max-w-2xl text-[15px] font-medium leading-7 text-slate-600">
                Built first for deck builders. Designed to expand to other project-based businesses.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="/demo/deck-project">
                  <Button size="lg">
                    Try the Deck Project Demo<ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
                <a href="/free-inquiry-audit">
                  <Button size="lg" variant="outline">Get a Free Website Inquiry Audit</Button>
                </a>
              </div>
              <p className="mt-5 text-[13px] font-medium text-slate-500">
                No credit card. No public setup required. Built for early pilot partners.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <img src="/og-image.png" alt="Métré Build product preview" className="h-52 w-full rounded-md object-cover" />
              <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">Example output</p>
                <h2 className="mt-2 text-xl font-semibold tracking-normal">Deck replacement project brief</h2>
                <div className="mt-4 grid gap-2 text-[15px] leading-6 text-slate-700">
                  {[
                    "Confirmed scope: elevated composite replacement",
                    "Constraints: stairs, backyard access, existing structure",
                    "Missing: permit review, exact structural condition",
                    "Next action: schedule site visit",
                  ].map((item) => (
                    <div key={item} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PROBLEM */}
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

        {/* PRODUCT OBJECTS */}
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

        {/* HOW IT WORKS */}
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
                    "Add it with a link or a small website snippet.",
                    "Review a structured brief before the first call.",
                  ][index]}
                />
              ))}
            </div>
          </div>
        </section>

        {/* DECK BUILDERS FOCUS */}
        <section className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[420px_1fr]">
            <SectionHeader
              eyebrow="Deck builders"
              title="Qualify deck projects before the first sales call."
              description="Starting with US deck builders and outdoor project companies. The Deck Playbook asks for the details that usually get rediscovered later."
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

        {/* EXAMPLE BRIEF — rebalanced two-column */}
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2 lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Example Project Brief</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950 md:text-4xl">
                What the sales team knows before calling.
              </h2>
              <p className="mt-4 text-[17px] leading-7 text-slate-700">
                Facts, missing details and suggested next action are separated so the first follow-up starts with real context — not a blank slate.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "What the homeowner wants",
                  "What is confirmed",
                  "What still needs checking",
                  "Whether the project is worth pursuing",
                  "What to do next",
                ].map((item) => (
                  <li key={item} className="flex gap-3 text-[16px] leading-6 text-slate-800">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                    <span className="font-medium">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="/example-project-brief">
                  <Button>View the full example brief<ArrowRight className="ml-2 h-4 w-4" /></Button>
                </a>
                <a href="/demo/deck-project">
                  <Button variant="outline">Try the deck demo</Button>
                </a>
              </div>
              <p className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 text-[14px] leading-6 text-slate-600">
                Métré Build prepares the conversation. It does not generate a final quote or replace a site visit.
              </p>
            </div>
            <BriefSummary brief={defaultDeckBrief} />
          </div>
        </section>

        {/* COMPARISON — deck builder specific */}
        <section className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader eyebrow="Difference" title='"I need a deck quote" vs a real project brief' />
            <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="grid grid-cols-1 border-b border-slate-200 bg-slate-100 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 md:grid-cols-2">
                <div className="p-4">Standard contact form</div>
                <div className="border-t border-slate-200 p-4 md:border-l md:border-t-0">Métré Build</div>
              </div>
              {[
                ["\u201CI need a deck quote\u201D", "New deck, replacement or resurfacing"],
                ["No measurements", "Approximate dimensions or range"],
                ["No site context", "Existing surface and access constraints"],
                ["Photos sent later by text", "Photos collected during intake"],
                ["First call starts from zero", "First call starts with project context"],
              ].map(([classic, build]) => (
                <ComparisonRow key={classic} classic={classic} build={build} />
              ))}
            </div>
          </div>
        </section>

        {/* HONEST DISCOVERY */}
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Honest by design"
              title="Built for real project discovery."
              description="Homeowners rarely know exact dimensions. That is fine — the goal is a useful brief, not a fake certainty."
            />
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <ObjectCard icon={CheckCircle2} title="Visitors can answer approximately" text="Ranges, 'not sure' and 'need to check' are first-class answers." />
              <ObjectCard icon={ShieldCheck} title="Missing information is clearly identified" text="Gaps are flagged in the brief so sales can prepare the right questions." />
              <ObjectCard icon={FileText} title="Assumptions are never presented as facts" text="Every line shows its source: visitor answer, rule, or calculated value." />
            </div>
          </div>
        </section>

        {/* INSTALL + FOUNDER PROOF */}
        <section className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <Link2 className="h-6 w-6 text-emerald-700" />
              <h3 className="mt-4 text-lg font-semibold tracking-normal text-slate-950">Easy to add to your site</h3>
              <p className="mt-2 text-[15px] leading-6 text-slate-700">
                Add it with a link or a small website snippet. No rebuild of your existing site required.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <HardHat className="h-6 w-6 text-emerald-700" />
              <h3 className="mt-4 text-lg font-semibold tracking-normal text-slate-950">Built by a builder, not a form vendor</h3>
              <p className="mt-2 text-[15px] leading-6 text-slate-700">
                Built by a construction entrepreneur with 15+ years of field experience.
              </p>
            </div>
          </div>
        </section>

        <PublicCtaBand />
      </main>
    </BuildPublicShell>
  );
}
