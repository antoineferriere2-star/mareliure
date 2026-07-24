import { BriefPreview } from "@/build/pages/public/BriefPreview";
import { defaultDeckBrief } from "@/build/pages/public/defaultDeckBrief";
import { deckPlaybookSchema } from "@/build/playbooks/deckPlaybookSchema";

const deckDemoSteps = deckPlaybookSchema.sections.flatMap((section) => section.steps);
import {
  BuildPublicShell,
  ContentBand,
  InfoPanel,
  PageHero,
  PublicCtaBand,
  SectionHeader,
  StepLine,
} from "@/build/pages/public/BuildPublicShell";

export function BuildDeckBuildersPage() {
  return (
    <BuildPublicShell>
      <main>
        <PageHero
          eyebrow="Deck Builders"
          title="Qualify deck projects before the first sales call."
          description="Métré Build helps deck builders replace vague inquiries with a guided intake that captures scope, site context, photos, budget, timing and contact consent."
          primary="Try the Deck Project Demo"
          primaryTo="/demo/deck-project"
          secondary="Get a Free Website Inquiry Audit"
          secondaryTo="/free-inquiry-audit"
        />
        <ContentBand
          title="Frequent inquiry gaps"
          items={[
            "Prospects do not know dimensions",
            "Photos arrive later by text",
            "Existing structure condition is unclear",
            "Budget and timing are missing",
            "Access constraints are discovered too late",
            "Sales has to restart discovery from scratch",
          ]}
        />
        <ContentBand
          muted
          title="What the Deck Playbook collects"
          items={[
            "New deck, replacement, extension or resurfacing",
            "Property and existing site condition",
            "Approximate length, width or area",
            "Height, stairs and access limitations",
            "Material preference",
            "Desired features",
            "Photos or plans",
            "Budget range and timeline",
            "ZIP code, contact details and consent",
          ]}
        />
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
            <SectionHeader
              title="A guided project journey, not a longer contact form."
              description="Each screen asks for one important decision and explains why it matters. Visitors can choose Not sure when dimensions, materials or scope are not ready yet."
            />
            <div className="space-y-3">
              {deckDemoSteps.slice(0, 6).map((step, index) => (
                <StepLine key={step.id} index={index + 1} title={step.title} text={step.why ?? ""} />
              ))}
            </div>
          </div>
        </section>
        <section className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_460px]">
            <SectionHeader
              title="What the sales team receives"
              description="A Project Brief separates confirmed visitor answers from deterministic checks, missing information and suggested next action."
            />
            <BriefPreview brief={defaultDeckBrief} compact />
          </div>
        </section>
        <ContentBand
          title="Benefits for the sales team"
          items={[
            "Start the first call with project context",
            "Spot missing information before follow-up",
            "Prioritize clearer projects",
            "Prepare site visit questions",
            "Keep early prospects in a useful workflow",
          ]}
        />
        <section className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader title="FAQ" />
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <InfoPanel title="Does it produce a final estimate?" items={["No. The demo produces a project brief, not a contractual estimate."]} />
              <InfoPanel title="Can we use our own questions?" items={["Pilot partners can customize the journey around their sales process."]} />
              <InfoPanel title="Does it replace sales?" items={["No. It prepares the first conversation so sales can move faster with better context."]} />
              <InfoPanel title="Is the beta public self-service?" items={["No. Métré Build is currently a private beta for selected project-based businesses."]} />
            </div>
          </div>
        </section>
        <PublicCtaBand />
      </main>
    </BuildPublicShell>
  );
}

export function BuildHowItWorksPage() {
  const stepTitles = ["Choose a Playbook", "Customize the project journey", "Add it to your website", "Receive structured project briefs"];
  const stepTexts = [
    "Start with a project-specific qualification method.",
    "Adjust copy and questions for your process.",
    "Embed the Mission where inquiries already happen.",
    "Review facts, gaps and suggested next action.",
  ];
  return (
    <BuildPublicShell>
      <main>
        <PageHero
          eyebrow="How it works"
          title="From vague inquiry to structured project brief."
          description="Métré Build gives prospects a guided project journey and gives the business a brief that prepares the first sales call."
          primary="Try the demo"
          primaryTo="/demo/deck-project"
          secondary="See an example brief"
          secondaryTo="/example-project-brief"
        />
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-4">
            {stepTitles.map((title, index) => (
              <StepLine key={title} index={index + 1} title={title} text={stepTexts[index]} />
            ))}
          </div>
        </section>
        <ContentBand
          muted
          title="What stays private"
          items={["Runtime sessions", "Real Project Briefs", "Visitor answers", "Private Playbooks", "Knowledge Records", "Administration"]}
        />
        <PublicCtaBand />
      </main>
    </BuildPublicShell>
  );
}

export function BuildExampleProjectBriefPage() {
  return (
    <BuildPublicShell>
      <main className="bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Example - fictional project created for demonstration purposes
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-normal text-slate-950">Example Project Brief</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            This page uses fictional data only. It shows the kind of structured output a deck builder can review after a guided Project Mission.
          </p>
          <div className="mt-8">
            <BriefPreview brief={defaultDeckBrief} />
          </div>
        </div>
      </main>
    </BuildPublicShell>
  );
}

export function BuildLegalPage({ title, paragraphs }: { title: string; paragraphs: string[] }) {
  return (
    <BuildPublicShell>
      <main className="px-4 py-16 sm:px-6 lg:px-8">
        <article className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-normal">{title}</h1>
          {paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-5 text-base leading-7 text-slate-600">{paragraph}</p>
          ))}
        </article>
      </main>
    </BuildPublicShell>
  );
}
