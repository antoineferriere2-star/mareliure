import { Button } from "@/components/ui/button";
import { BriefPreview } from "@/build/pages/public/BriefPreview";
import { defaultDeckBrief } from "@/build/pages/public/defaultDeckBrief";
import { deckPlaybookSchema } from "@/build/playbooks/deckPlaybookSchema";
import { PLAN_DEFAULTS, type MonthlyUsdPrice, type PlanId } from "@/build/billing/plans";
import { BeforeAfterSection } from "@/build/pages/public/sections/BeforeAfterSection";

const deckDemoSteps = deckPlaybookSchema.sections.flatMap((section) => section.steps);
import {
  BuildPublicShell,
  CheckItem,
  ContentBand,
  InfoPanel,
  PageHero,
  PublicCtaBand,
  SectionHeader,
  StepLine,
} from "@/build/pages/public/BuildPublicShell";
import {
  publicCopies,
  publicCopy,
  usePublicLocale,
} from "@/build/pages/public/publicLocaleContext";

export function BuildDeckBuildersPage() {
  return (
    <BuildPublicShell>
      <BuildDeckBuildersPageContent />
    </BuildPublicShell>
  );
}

function BuildDeckBuildersPageContent() {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);

  return (
    <main>
      <PageHero
        eyebrow={copy("Deck Builders")}
        title={copy("Qualify deck projects before the first sales call.")}
        description={copy(
          "Métré Build helps deck builders turn vague website inquiries into structured Project Briefs with scope, site context, photos, budget, timing and contact consent.",
        )}
        primary={copy("Analyze My Website Free")}
        primaryTo="/free-inquiry-audit"
        secondary={copy("Try the Live Deck Intake")}
        secondaryTo="/demo/deck-project"
        secondaryVariant="link"
      />
      <ContentBand
        title={copy("Frequent inquiry gaps")}
        items={publicCopies(locale, [
          "Prospects do not know dimensions",
          "Photos arrive later by text",
          "Existing structure condition is unclear",
          "Budget and timing are missing",
          "Access constraints are discovered too late",
          "Sales has to rediscover the project from scratch",
        ])}
      />
      <ContentBand
        muted
        title={
          <>
            {locale === "es-US" ? "Qué recopila el Deck" : "What the Deck"}{" "}
            <span
              className="cursor-help underline decoration-dotted decoration-slate-400 underline-offset-4"
              title={copy("A reusable industry-specific project discovery method.")}
            >
              Playbook
            </span>{" "}
            {locale === "es-US" ? "" : "collects"}
          </>
        }
        items={publicCopies(locale, [
          "New deck, replacement, extension or resurfacing",
          "Property and existing site condition",
          "Approximate length, width or area",
          "Height, stairs and access limitations",
          "Material preference",
          "Desired features",
          "Photos or plans",
          "Budget range and timeline",
          "ZIP code, contact details and consent",
        ])}
      />
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2 lg:items-start">
          <SectionHeader
            title={copy("A guided project journey, not a longer contact form.")}
            description={copy(
              "Each screen asks for one important decision and explains why it matters. Visitors can choose Not sure when dimensions, materials or scope are not ready yet.",
            )}
          />
          <div className="space-y-3">
            {deckDemoSteps.slice(0, 6).map((step, index) => (
              <StepLine
                key={step.id}
                index={index + 1}
                title={copy(step.title)}
                text={copy(step.why ?? "")}
              />
            ))}
          </div>
        </div>
      </section>
      <section className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_460px] lg:items-start">
          <SectionHeader
            title={copy("What the sales team receives")}
            description={copy(
              "A Project Brief separates confirmed visitor answers from deterministic checks, missing information and suggested next action.",
            )}
          />
          <BriefPreview brief={defaultDeckBrief} compact />
        </div>
      </section>
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-4 rounded-lg border border-slate-200 bg-slate-50 p-8">
          <h2 className="text-2xl font-semibold tracking-normal text-slate-950">
            {copy("See what this could look like on your website.")}
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <a href="/free-inquiry-audit">
              <Button>{copy("Analyze My Website Free")}</Button>
            </a>
            <a href="/demo/deck-project">
              <Button variant="link" className="h-auto p-0 text-base">
                {copy("Try the Live Deck Intake")}
              </Button>
            </a>
          </div>
        </div>
      </section>
      <ContentBand
        title={copy("Benefits for the sales team")}
        items={publicCopies(locale, [
          "Start the first call with project context",
          "Spot missing information before follow-up",
          "Prioritize clearer projects",
          "Prepare site visit questions",
          "Keep early prospects in a useful workflow",
        ])}
      />
      <section className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader title={copy("FAQ")} />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <InfoPanel
              title={copy("Does it produce a final estimate?")}
              items={publicCopies(locale, [
                "No. The demo produces a project brief, not a contractual estimate.",
              ])}
            />
            <InfoPanel
              title={copy("Can we use our own questions?")}
              items={publicCopies(locale, [
                "You can customize the journey around your sales process.",
              ])}
            />
            <InfoPanel
              title={copy("Does it replace sales?")}
              items={publicCopies(locale, [
                "No. It prepares the first conversation so sales can move faster with better context.",
              ])}
            />
            <InfoPanel
              title={copy("Is this self-service?")}
              items={publicCopies(locale, [
                "Setup is currently guided - we configure your first Playbook with you, and once published it runs on your site for visitors who choose to start it.",
              ])}
            />
          </div>
        </div>
      </section>
      <PublicCtaBand />
    </main>
  );
}

export function BuildHowItWorksPage() {
  return (
    <BuildPublicShell>
      <BuildHowItWorksPageContent />
    </BuildPublicShell>
  );
}

function BuildHowItWorksPageContent() {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);
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
    <main>
      <PageHero
        eyebrow={copy("How it works")}
        title={copy("From vague inquiry to structured Project Brief.")}
        description={copy(
          "Métré Build gives prospects a guided project journey and gives the business a brief that prepares the first sales call.",
        )}
        primary={copy("Try the Live Deck Intake")}
        primaryTo="/demo/deck-project"
        secondary={copy("See an example brief")}
        secondaryTo="/example-project-brief"
        secondaryVariant="link"
      />
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader title={copy("From website audit to live Project Intake")} />
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {journeySteps.map((step, index) => (
              <StepLine
                key={step.title}
                index={index + 1}
                title={copy(step.title)}
                text={copy(step.text)}
              />
            ))}
          </div>
        </div>
      </section>
      <ContentBand
        muted
        title={copy("What stays private")}
        items={publicCopies(locale, [
          "Runtime sessions",
          "Real Project Briefs",
          "Visitor answers",
          "Private Playbooks",
          "Knowledge Records",
          "Administration",
        ])}
      />
      <BeforeAfterSection />
      <PublicCtaBand />
    </main>
  );
}

const SELF_SERVE_PLAN_IDS: PlanId[] = ["launch", "growth", "pro", "business"];

function PlanPrice({
  price,
  copy,
}: {
  price: MonthlyUsdPrice | null;
  copy: (text: string) => string;
}) {
  if (!price) {
    return (
      <p className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">{copy("Custom")}</p>
    );
  }
  const dollars = price.amountCents / 100;
  const hasCents = price.amountCents % 100 !== 0;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(dollars);
  return (
    <p className="mt-3 flex items-baseline gap-1">
      <span className="text-3xl font-semibold tracking-normal text-slate-950">{formatted}</span>
      <span className="text-sm font-medium text-slate-500">{copy("/month")}</span>
    </p>
  );
}

export function BuildPricingPage() {
  return (
    <BuildPublicShell>
      <BuildPricingPageContent />
    </BuildPublicShell>
  );
}

function BuildPricingPageContent() {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);

  return (
    <main>
      <PageHero
        eyebrow={copy("Pricing")}
        title={copy("Simple pricing that scales with your Project Intakes.")}
        description={copy(
          "Every plan includes the same guided Project Intake, AI-drafted Project Briefs and client portal. Plans only differ by how many active Project Intakes and monthly Project Briefs you need.",
        )}
        primary={copy("Create account")}
        primaryTo="/auth"
        secondary={copy("Talk to us")}
        secondaryTo="/contact"
        secondaryVariant="link"
      />
      <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
        <p className="text-sm leading-6 text-slate-600">
          {copy(
            "You can try the public Deck demo before creating an account. Once you sign up, you get your own workspace right away and can publish your first Guided Project Intake yourself.",
          )}{" "}
          <a href="/private-beta" className="font-medium text-emerald-700 hover:underline">
            {copy("Prefer a guided setup instead?")}
          </a>
        </p>
      </div>
      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 lg:grid-cols-4">
          {SELF_SERVE_PLAN_IDS.map((planId) => {
            const plan = PLAN_DEFAULTS[planId];
            return (
              <section
                key={planId}
                className="flex flex-col rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
              >
                <h3 className="text-lg font-semibold tracking-normal text-slate-950">
                  {plan.label}
                </h3>
                <PlanPrice price={plan.monthlyUsdPrice} copy={copy} />
                <div className="mt-5 space-y-2">
                  <CheckItem>
                    {plan.maxActiveMissions}{" "}
                    {copy(
                      plan.maxActiveMissions === 1
                        ? "active Project Intake"
                        : "active Project Intakes",
                    )}
                  </CheckItem>
                  <CheckItem>
                    {plan.monthlyBriefQuota?.toLocaleString("en-US")}{" "}
                    {copy("Project Briefs / month")}
                  </CheckItem>
                </div>
                <a href="/auth" className="mt-6">
                  <Button variant="outline" className="w-full">
                    {copy("Create account")}
                  </Button>
                </a>
              </section>
            );
          })}
        </div>
        <div className="mx-auto mt-6 max-w-7xl">
          <section className="flex flex-col items-start gap-4 rounded-lg border border-slate-200 bg-slate-50 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold tracking-normal text-slate-950">
                {copy("Enterprise")}
              </h3>
              <p className="mt-2 max-w-2xl text-[15px] leading-6 text-slate-700">
                {copy(
                  "For teams that need more active Project Intakes, a higher monthly Project Brief quota, or custom terms.",
                )}
              </p>
            </div>
            <a href="/contact">
              <Button variant="outline">{copy("Talk to us")}</Button>
            </a>
          </section>
        </div>
      </section>
      <ContentBand
        title={copy("Every plan includes")}
        items={publicCopies(locale, [
          "Guided Project Intake for your website",
          "AI-drafted Project Briefs",
          "Secure Project Summary link and email copy for visitors",
          "Client portal access for your team",
        ])}
      />
      <section className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader title={copy("Pricing FAQ")} />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <InfoPanel
              title={copy("What counts as an active Project Intake?")}
              items={publicCopies(locale, [
                "Each Project Intake published on your website counts toward your plan's limit, whether or not it is currently receiving visitors.",
              ])}
            />
            <InfoPanel
              title={copy("What counts as a Project Brief?")}
              items={publicCopies(locale, [
                "Each completed Project Intake that produces a Project Brief counts once toward your monthly quota, reset every billing cycle.",
              ])}
            />
            <InfoPanel
              title={copy("Can I change plans later?")}
              items={publicCopies(locale, [
                "Yes. You can change your plan at any time from your client portal billing page.",
              ])}
            />
            <InfoPanel
              title={copy("Is there a free trial?")}
              items={publicCopies(locale, [
                "Analyze your website first to see what a Project Brief looks like for your business, with no account required.",
              ])}
            />
          </div>
        </div>
      </section>
      <PublicCtaBand />
    </main>
  );
}

export function BuildExampleProjectBriefPage() {
  return (
    <BuildPublicShell>
      <BuildExampleProjectBriefPageContent />
    </BuildPublicShell>
  );
}

function BuildExampleProjectBriefPageContent() {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);

  return (
    <main className="bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
          {copy("Example - fictional project created for demonstration purposes")}
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-normal text-slate-950">
          {copy("Example Project Brief")}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          {copy(
            "This page uses fictional data only. It shows the kind of structured output a deck builder can review after a guided Project Intake.",
          )}
        </p>
        <div className="mt-8">
          <BriefPreview brief={defaultDeckBrief} />
        </div>
        <div className="mt-8 flex flex-col items-start gap-4 rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold tracking-normal text-slate-950">
            {copy("Want Project Briefs like this from your own website?")}
          </h2>
          <p className="max-w-2xl text-[15px] leading-7 text-slate-700">
            {copy(
              "Start with a ready-to-use industry journey, adapt it to your business and add it to your website with a link or simple snippet.",
            )}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <a href="/free-inquiry-audit">
              <Button>{copy("Analyze My Website Free")}</Button>
            </a>
            <a href="/demo/deck-project">
              <Button variant="link" className="h-auto p-0 text-base">
                {copy("Try the Live Deck Intake")}
              </Button>
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

export interface LegalSection {
  heading: string;
  body: string[];
}

/**
 * LEGAL REVIEW REQUIRED before production publication. The content passed
 * to this component (privacy.tsx, terms.tsx) is a structured draft written
 * to be complete and honest about what the product actually does, but it
 * has not been reviewed by a lawyer. Placeholders for facts we don't have
 * (legal entity name, registered address, DPO, governing law, contractual
 * retention periods) are phrased as "to be confirmed" rather than invented
 * — do not replace them with plausible-sounding values without verifying
 * them first.
 */
export function BuildLegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <BuildPublicShell>
      <BuildLegalPageContent title={title} updated={updated} sections={sections} />
    </BuildPublicShell>
  );
}

function BuildLegalPageContent({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: LegalSection[];
}) {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);

  return (
    <main className="px-4 py-16 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-normal">{copy(title)}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {copy("Last updated")}: {updated}
        </p>
        {sections.map((section) => (
          <section key={section.heading} className="mt-8">
            <h2 className="text-xl font-semibold tracking-normal text-slate-950">
              {copy(section.heading)}
            </h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="mt-3 text-base leading-7 text-slate-600">
                {copy(paragraph)}
              </p>
            ))}
          </section>
        ))}
      </article>
    </main>
  );
}
