import { Button } from "@/components/ui/button";
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
          primary="Get a Free Website Inquiry Audit"
          primaryTo="/free-inquiry-audit"
          secondary="Try the Live Deck Intake"
          secondaryTo="/demo/deck-project"
          secondaryVariant="link"
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
          title={
            <>
              What the Deck{" "}
              <span
                className="cursor-help underline decoration-dotted decoration-slate-400 underline-offset-4"
                title="A reusable industry-specific project discovery method."
              >
                Playbook
              </span>{" "}
              collects
            </>
          }
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
                <StepLine
                  key={step.id}
                  index={index + 1}
                  title={step.title}
                  text={step.why ?? ""}
                />
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
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-5xl flex-col items-start gap-4 rounded-lg border border-slate-200 bg-slate-50 p-8">
            <h2 className="text-2xl font-semibold tracking-normal text-slate-950">
              See what this could look like on your website.
            </h2>
            <div className="flex flex-wrap items-center gap-4">
              <a href="/free-inquiry-audit">
                <Button>Get a Free Website Inquiry Audit</Button>
              </a>
              <a href="/demo/deck-project">
                <Button variant="link" className="h-auto p-0 text-base">
                  Try the Live Deck Intake
                </Button>
              </a>
            </div>
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
              <InfoPanel
                title="Does it produce a final estimate?"
                items={["No. The demo produces a project brief, not a contractual estimate."]}
              />
              <InfoPanel
                title="Can we use our own questions?"
                items={["You can customize the journey around your sales process."]}
              />
              <InfoPanel
                title="Does it replace sales?"
                items={[
                  "No. It prepares the first conversation so sales can move faster with better context.",
                ]}
              />
              <InfoPanel
                title="Is this self-service?"
                items={[
                  "Setup is currently guided — we configure your first Playbook with you, and once published it runs on your site for every visitor.",
                ]}
              />
            </div>
          </div>
        </section>
        <PublicCtaBand />
      </main>
    </BuildPublicShell>
  );
}

export function BuildHowItWorksPage() {
  const journeySteps = [
    {
      title: "We review your website",
      text: "We identify what your current inquiry journey collects and what your sales team still has to ask.",
    },
    {
      title: "You start from a ready-to-use Playbook",
      text: "We match your business and selected service with the closest available Project Intake.",
    },
    {
      title: "You review and adjust it",
      text: "Confirm the wording, optional questions, branding and Project Brief.",
    },
    {
      title: "Add it to your site",
      text: "Publish it with a link or simple website snippet.",
    },
  ];
  return (
    <BuildPublicShell>
      <main>
        <PageHero
          eyebrow="How it works"
          title="From vague inquiry to structured project brief."
          description="Métré Build gives prospects a guided project journey and gives the business a brief that prepares the first sales call."
          primary="Try the Live Deck Intake"
          primaryTo="/demo/deck-project"
          secondary="See an example brief"
          secondaryTo="/example-project-brief"
          secondaryVariant="link"
        />
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader title="From website audit to live Project Intake" />
            <div className="mt-8 grid gap-4 md:grid-cols-4">
              {journeySteps.map((step, index) => (
                <StepLine key={step.title} index={index + 1} title={step.title} text={step.text} />
              ))}
            </div>
          </div>
        </section>
        <ContentBand
          muted
          title="What stays private"
          items={[
            "Runtime sessions",
            "Real Project Briefs",
            "Visitor answers",
            "Private Playbooks",
            "Knowledge Records",
            "Administration",
          ]}
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
          <h1 className="mt-4 text-4xl font-semibold tracking-normal text-slate-950">
            Example Project Brief
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            This page uses fictional data only. It shows the kind of structured output a deck
            builder can review after a guided Project Intake.
          </p>
          <div className="mt-8">
            <BriefPreview brief={defaultDeckBrief} />
          </div>
          <div className="mt-8 flex flex-col items-start gap-4 rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-semibold tracking-normal text-slate-950">
              Want Project Briefs like this from your own website?
            </h2>
            <p className="max-w-2xl text-[15px] leading-7 text-slate-700">
              Start with a ready-to-use industry journey, adapt it to your business and add it to
              your website with a link or simple snippet.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <a href="/free-inquiry-audit">
                <Button>Get a Free Website Inquiry Audit</Button>
              </a>
              <a href="/demo/deck-project">
                <Button variant="link" className="h-auto p-0 text-base">
                  Try the Live Deck Intake
                </Button>
              </a>
            </div>
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
            <p key={paragraph} className="mt-5 text-base leading-7 text-slate-600">
              {paragraph}
            </p>
          ))}
        </article>
      </main>
    </BuildPublicShell>
  );
}
