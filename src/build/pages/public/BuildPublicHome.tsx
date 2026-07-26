import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Layers3,
  Sparkles,
  Link2,
  ShieldCheck,
  HardHat,
  Users,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BuildPublicShell,
  CheckItem,
  InfoPanel,
  ObjectCard,
  SectionHeader,
  StepLine,
} from "@/build/pages/public/BuildPublicShell";
import { TimelineField } from "@/build/engine/fields/TimelineField";
import { BriefSummary } from "@/build/pages/public/BriefSummary";
import { HeroTransformShot } from "@/build/pages/public/sections/HeroTransformShot";
import { DossiersListPreview } from "@/build/pages/public/AdminPreviewShots";
import { InspirationSection } from "@/build/pages/public/sections/InspirationSection";
import { BeforeAfterSection } from "@/build/pages/public/sections/BeforeAfterSection";
import { InsideMetreBuildSection } from "@/build/pages/public/sections/InsideMetreBuildSection";
import {
  demoTimelineField,
  demoJaneMillerBrief,
  demoDossiersRows,
} from "@/build/content/demoProductData";
import type { AnswerValue } from "@/build/schema/answers";

function DualValueTimelinePreview() {
  const [value, setValue] = useState<AnswerValue | undefined>(undefined);
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        Live example
      </p>
      <div className="mt-2">
        <TimelineField field={demoTimelineField} value={value} onChange={setValue} />
      </div>
    </div>
  );
}


export function BuildPublicHome() {
  return (
    <BuildPublicShell>
      <main>
        {/* HERO */}
        <section className="overflow-hidden bg-slate-50 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[minmax(0,1fr)_1.05fr] lg:gap-10">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Project discovery for project-based businesses
              </p>
              <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl lg:text-5xl">
                Turn vague website inquiries into sales-ready project briefs.
              </h1>
              <p className="mt-4 max-w-2xl text-[17px] leading-7 text-slate-700">
                Métré Build guides customers through the details they know, helps them clarify what
                they do not, and gives your sales team the context they need before the first call.
              </p>
              <p className="mt-3 max-w-2xl text-[15px] font-medium leading-6 text-slate-600">
                More helpful than a form. Simpler than a custom configurator.
              </p>
              <p className="mt-2 max-w-2xl text-[15px] font-medium leading-6 text-slate-700">
                Customers get a simpler way to explain their project. Sales teams get a clearer
                brief to act on.
              </p>
              <p className="mt-2 max-w-2xl text-[13px] leading-5 text-slate-500">
                Built for businesses selling projects that require discovery before quoting: decks,
                pergolas, pools, windows, kitchens, solar, custom equipment and more.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="/demo/deck-project">
                  <Button size="lg">
                    Try the Deck Project Demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
                <a href="/free-inquiry-audit">
                  <Button size="lg" variant="outline">
                    Get a Free Website Inquiry Audit
                  </Button>
                </a>
              </div>
              <p className="mt-4 text-[13px] font-medium text-slate-500">
                No credit card. Add it to your website with a link or a simple snippet.
              </p>
            </div>
            <HeroTransformShot brief={demoJaneMillerBrief} />
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
              <InfoPanel
                title="Classic forms often capture"
                items={["Name", "Email", "Phone number", "A vague free-text message"]}
              />
              <InfoPanel
                title="They usually miss"
                items={[
                  "Dimensions",
                  "Photos",
                  "Budget",
                  "Timeline",
                  "Constraints",
                  "Missing information",
                  "Next commercial action",
                ]}
              />
            </div>
          </div>
        </section>

        {/* DUAL VALUE — CUSTOMER + SALES */}
        <section className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Two sides of the same journey"
              title="Easier for your customers. More useful for your sales team."
            />
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <Users className="h-6 w-6 text-emerald-700" />
                <h3 className="mt-4 text-lg font-semibold tracking-normal text-slate-950">
                  For your customers
                </h3>
                <div className="mt-4 space-y-2">
                  {[
                    "No technical vocabulary required",
                    "Guided questions and visual choices",
                    "\u201CNot sure\u201D options when details are unknown",
                    "Photos instead of long explanations",
                    "A clear recap before submission",
                  ].map((item) => (
                    <CheckItem key={item}>{item}</CheckItem>
                  ))}
                </div>
                <DualValueTimelinePreview />
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <Briefcase className="h-6 w-6 text-emerald-700" />
                <h3 className="mt-4 text-lg font-semibold tracking-normal text-slate-950">
                  For your sales team
                </h3>
                <div className="mt-4 space-y-2">
                  {[
                    "Structured project context",
                    "Confirmed details separated from assumptions",
                    "Photos, budget and timing in one place",
                    "Missing information clearly identified",
                    "A suggested next action",
                  ].map((item) => (
                    <CheckItem key={item}>{item}</CheckItem>
                  ))}
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Live example
                </p>
                <div className="mt-2">
                  <DossiersListPreview rows={demoDossiersRows.slice(0, 2)} />
                </div>
              </div>
            </div>
            <p className="mt-8 text-center text-[16px] font-medium leading-7 text-slate-700">
              Help customers explain the project. Help sales teams act on it.
            </p>
          </div>
        </section>

        <InspirationSection />

        {/* PRODUCT OBJECTS */}
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Product"
              title="Not a generic form builder."
              description="Métré Build uses industry Playbooks to guide customers and turn incomplete inquiries into structured, actionable Project Briefs."
            />
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <ObjectCard
                icon={Layers3}
                title="Playbook"
                text="A reusable industry-specific project discovery method."
              />
              <ObjectCard
                icon={Sparkles}
                title="Project Mission"
                text="The guided experience completed by the customer."
              />
              <ObjectCard
                icon={FileText}
                title="Project Brief"
                text="The structured, actionable output received by the sales team."
              />
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <p className="rounded-md border border-slate-200 bg-slate-50 p-5 text-[15px] leading-7 text-slate-700">
                Typeform organizes questions. Métré Build organizes the understanding of a project.
              </p>
              <p className="rounded-md border border-slate-200 bg-slate-50 p-5 text-[15px] leading-7 text-slate-700">
                A custom configurator produces a technical solution. Métré Build produces the right
                project context to move toward that solution.
              </p>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="How it works"
              title="A simple path from inquiry to commercial context."
            />
            <div className="mt-8 grid gap-3 md:grid-cols-4">
              {[
                "Choose a Playbook",
                "Customize the project journey",
                "Add it to your website",
                "Receive structured Project Briefs",
              ].map((step, index) => (
                <StepLine
                  key={step}
                  index={index + 1}
                  title={step}
                  text={
                    [
                      "Start with an industry-specific discovery method.",
                      "Tune the guided journey for your process.",
                      "Add it with a link or a small website snippet.",
                      "Review a structured brief before the first call.",
                    ][index]
                  }
                />
              ))}
            </div>
            <p className="mt-4 text-[14px] leading-6 text-slate-600">
              Every Project Brief carries its own confidence level (
              {demoJaneMillerBrief.confidence.label}) and lists exactly what is still missing —
              never a fake certainty.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="/demo/deck-project">
                <Button>
                  Try the Deck Project Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        </section>

        <BeforeAfterSection />
        <InsideMetreBuildSection />

        {/* MULTI-VERTICAL */}
        <section className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Horizontal by design"
              title="Built for projects that cannot be explained in one text box"
              description="Métré Build is designed for businesses where every inquiry requires context, constraints and project discovery before a useful quote or sales conversation can happen."
            />
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                "Decks and outdoor living",
                "Pools and spas",
                "Windows and doors",
                "Kitchens and remodeling",
                "Solar and energy projects",
                "Custom industrial equipment",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-md border border-slate-200 bg-white p-4 text-[15px] font-medium leading-6 text-slate-800"
                >
                  {item}
                </div>
              ))}
            </div>
            <p className="mt-6 text-[14px] leading-6 text-slate-600">
              Deck Projects is the first live Playbook. Other industries will follow based on real
              customer demand.
            </p>
          </div>
        </section>

        {/* 3-COL COMPARISON */}
        <section className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Positioning"
              title="The missing layer between forms and configurators"
            />
            <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="grid grid-cols-1 border-b border-slate-200 bg-slate-100 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 md:grid-cols-3">
                <div className="p-4">Generic form</div>
                <div className="border-t border-slate-200 bg-emerald-100 p-4 text-emerald-900 md:border-l md:border-t-0">
                  Métré Build
                </div>
                <div className="border-t border-slate-200 p-4 md:border-l md:border-t-0">
                  Custom configurator
                </div>
              </div>
              {[
                ["Collects answers", "Guides project discovery", "Configures a technical solution"],
                ["Generic questions", "Industry Playbooks", "Product-specific rules"],
                [
                  "Customer must know what to write",
                  "Customer can answer approximately",
                  "Customer makes technical choices",
                ],
                ["Form submission", "Sales-ready Project Brief", "Configuration or quote"],
                ["Fast but often vague", "Fast and structured", "Powerful but complex"],
                ["Low setup", "Accessible SaaS", "Custom software project"],
              ].map(([a, b, c]) => (
                <div
                  key={b}
                  className="grid border-b border-slate-200 last:border-b-0 md:grid-cols-3"
                >
                  <div className="p-4 text-[15px] leading-6 text-slate-700">{a}</div>
                  <div className="border-t border-slate-200 bg-emerald-50 p-4 text-[15px] font-medium leading-6 text-emerald-950 md:border-l md:border-t-0">
                    {b}
                  </div>
                  <div className="border-t border-slate-200 p-4 text-[15px] leading-6 text-slate-700 md:border-l md:border-t-0">
                    {c}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-[15px] leading-7 text-slate-700">
              Métré Build helps customers clarify their project without forcing your business to
              build a custom configurator.
            </p>
          </div>
        </section>

        {/* HONEST DISCOVERY */}
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Honest by design"
              title="Built for real project discovery."
              description="Customers rarely know exact dimensions. That is fine — the goal is a useful brief, not a fake certainty."
            />
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <ObjectCard
                icon={CheckCircle2}
                title="Customers can answer approximately"
                text="Ranges, 'not sure' and 'need to check' are first-class answers."
              />
              <ObjectCard
                icon={ShieldCheck}
                title="Missing information is clearly identified"
                text="Gaps are flagged in the brief so sales can prepare the right questions."
              />
              <ObjectCard
                icon={FileText}
                title="Assumptions are never presented as facts"
                text="Every line shows its source: visitor answer, rule, or calculated value."
              />
            </div>
          </div>
        </section>

        {/* INSTALL + FOUNDER PROOF */}
        <section className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <Link2 className="h-6 w-6 text-emerald-700" />
              <h3 className="mt-4 text-lg font-semibold tracking-normal text-slate-950">
                Easy to add to your site
              </h3>
              <p className="mt-2 text-[15px] leading-6 text-slate-700">
                Add it with a link or a small website snippet. No rebuild of your existing site
                required.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <HardHat className="h-6 w-6 text-emerald-700" />
              <h3 className="mt-4 text-lg font-semibold tracking-normal text-slate-950">
                Built by a builder, not a form vendor
              </h3>
              <p className="mt-2 text-[15px] leading-6 text-slate-700">
                Built by a construction entrepreneur with 15+ years of field experience.
              </p>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="bg-slate-950 px-4 py-16 text-white sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-200">
                Get started
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-normal md:text-4xl">
                See what your current website form is missing.
              </h2>
              <p className="mt-3 max-w-xl text-[16px] leading-7 text-slate-300">
                Give customers a better way to explain their project and give your sales team a
                better place to start.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="/free-inquiry-audit">
                <Button size="lg">Get a Free Website Inquiry Audit</Button>
              </a>
              <a href="/demo/deck-project">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white bg-transparent text-white hover:bg-white hover:text-slate-950"
                >
                  Try the Deck Project Demo
                </Button>
              </a>
            </div>
          </div>
        </section>
      </main>
    </BuildPublicShell>
  );
}
