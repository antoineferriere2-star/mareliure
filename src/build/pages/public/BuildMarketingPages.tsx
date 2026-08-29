import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BriefPreview } from "@/build/pages/public/BriefPreview";
import { defaultDeckBrief } from "@/build/pages/public/defaultDeckBrief";
import { ProjectCanvas } from "@/build/pages/public/ProjectCanvas";
import type { ProjectCanvasItem } from "@/build/pages/public/ProjectCanvasProjection";
import { deckPlaybookSchema } from "@/build/playbooks/deckPlaybookSchema";
import { PLAN_DEFAULTS, type MonthlyUsdPrice, type PlanId } from "@/build/billing/plans";

const deckDemoSteps = deckPlaybookSchema.sections.flatMap((section) => section.steps);
import { DECK_BUILDERS_FAQ, PRICING_FAQ } from "@/build/content/publicFaq";
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
            {/* Rendered from the same array the FAQPage structured data is
                built from — see src/build/content/publicFaq.ts. */}
            {DECK_BUILDERS_FAQ.map((entry) => (
              <InfoPanel
                key={entry.question}
                title={copy(entry.question)}
                items={publicCopies(locale, [entry.answer])}
              />
            ))}
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
  const projectCanvas: ProjectCanvasItem[] = [
    {
      id: "how-project",
      group: copy("Project"),
      label: copy("Project"),
      value: copy("Deck replacement"),
      status: "confirmed",
    },
    {
      id: "how-material",
      group: copy("Preferences"),
      label: copy("Material"),
      value: copy("Composite decking"),
      status: "approximate",
    },
    {
      id: "how-area",
      group: copy("Derived"),
      label: copy("Approximate area"),
      value: copy("Calculated from dimensions"),
      status: "derived",
    },
    {
      id: "how-open",
      group: copy("To clarify"),
      label: copy("Access"),
      value: copy("Confirm before first call"),
      status: "clarify",
    },
  ];

  return (
    <main className="bg-[#f7f3ec]">
      <PageHero
        eyebrow={copy("How it works")}
        title={copy("From vague inquiry to a project your team can act on.")}
        description={copy(
          "A visitor starts with what they know. Métré keeps building the project context, keeps unknowns explicit, and gives sales a structured Project Brief.",
        )}
        primary={copy("Try a live project intake")}
        primaryTo="/demo/deck-project"
        secondary={copy("See an example brief")}
        secondaryTo="/example-project-brief"
        secondaryVariant="link"
      />
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.72fr_1fr] lg:items-start">
          <div>
            <SectionHeader
              title={copy("The intake is not the product. The project is.")}
              description={copy(
                "Métré asks enough to understand what is known, what is approximate, what can be derived, and what still needs clarification.",
              )}
            />
            <div className="mt-8 space-y-5 border-y border-stone-200 py-6">
              {[
                ["Visitor", "Starts with an incomplete idea and answers focused questions."],
                ["Project Canvas", "Keeps the developing project visible as facts arrive."],
                ["Project Brief", "Turns the same project into commercial context for sales."],
              ].map(([title, text]) => (
                <div key={title} className="grid gap-2 sm:grid-cols-[120px_1fr]">
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-stone-500">
                    {copy(title)}
                  </p>
                  <p className="text-[16px] leading-7 text-stone-700">{copy(text)}</p>
                </div>
              ))}
            </div>
          </div>
          <ProjectCanvas
            title={copy("Project Canvas")}
            eyebrow={copy("During the intake")}
            items={projectCanvas}
            emptyText={copy("Project details will appear here.")}
          />
        </div>
      </section>
      <section className="bg-[#fffdf8] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            title={copy("Playbook -> Project Intake -> Project Brief")}
            description={copy(
              "The Playbook is how Métré knows what to understand. The Project Intake is how the customer builds the project. The Project Brief is what sales receives.",
            )}
          />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              ["1", "Playbook", "Industry-specific discovery logic, reviewed by the business."],
              ["2", "Project Intake", "A guided visitor experience that accepts uncertainty."],
              ["3", "Project Brief", "A structured sales document before the first call."],
            ].map(([index, title, text]) => (
              <section key={title} className="border-t border-stone-300 pt-5">
                <span className="text-sm font-semibold text-emerald-700">{index}</span>
                <h3 className="mt-3 text-xl font-semibold tracking-normal text-stone-950">
                  {copy(title)}
                </h3>
                <p className="mt-2 text-[15px] leading-7 text-stone-600">{copy(text)}</p>
              </section>
            ))}
          </div>
        </div>
      </section>
      <ContentBand
        title={copy("What stays explicit")}
        items={publicCopies(locale, [
          "Confirmed visitor answers",
          "Approximate answers",
          "Calculated or rule-derived values",
          "Missing information",
          "Qualification confidence",
          "Suggested next commercial action",
        ])}
      />
      <RelatedReading>
        {copy("See it for one trade:")}{" "}
        <Link to="/deck-builders" className={INLINE_LINK}>
          {copy("lead qualification for deck builders")}
        </Link>
        {copy(", or read")}{" "}
        <Link to="/example-project-brief" className={INLINE_LINK}>
          {copy("an example Project Brief, annotated line by line")}
        </Link>
        .
      </RelatedReading>
      <PublicCtaBand />
    </main>
  );
}

/**
 * Contextual links written into the body copy.
 *
 * Every page already exposes the same nav and the same footer, which tells a
 * crawler nothing about which page matters. A link inside the prose, with an
 * anchor that says where it leads, is the only signal that does. One sentence
 * per page — a block of "related links" is navigation wearing a different hat,
 * and carries the same non-signal.
 */
function RelatedReading({ children }: { children: React.ReactNode }) {
  return (
    <section className="px-4 py-10 sm:px-6 lg:px-8">
      <p className="mx-auto max-w-3xl text-[15px] leading-7 text-slate-600">{children}</p>
    </section>
  );
}

const INLINE_LINK =
  "font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-900";

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
    <main className="bg-[#f7f3ec]">
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
            "You can try the live public intake before creating an account. Once you sign up, you get your own workspace right away and can publish your first Guided Project Intake yourself.",
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
                className="metre-frame flex flex-col rounded-lg bg-[#fffdf8] p-6"
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
          <section className="metre-frame flex flex-col items-start gap-4 rounded-lg bg-[#fffdf8] p-6 sm:flex-row sm:items-center sm:justify-between">
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
            {PRICING_FAQ.map((entry) => (
              <InfoPanel
                key={entry.question}
                title={copy(entry.question)}
                items={publicCopies(locale, [entry.answer])}
              />
            ))}
          </div>
        </div>
      </section>
      <RelatedReading>
        {copy("Not sure which plan fits? Start from the trade page:")}{" "}
        <Link to="/deck-builders" className={INLINE_LINK}>
          {copy("what a deck builder's Project Intake collects")}
        </Link>
        .
      </RelatedReading>
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
  const originCanvas: ProjectCanvasItem[] = [
    {
      id: "brief-visitor-said",
      group: copy("Visitor said"),
      label: copy("Project"),
      value: copy("New deck"),
      status: "confirmed",
    },
    {
      id: "brief-derived",
      group: copy("Métré derived"),
      label: copy("Approximate area"),
      value: copy("320 sq ft"),
      status: "derived",
    },
    {
      id: "brief-unknown",
      group: copy("Still unknown"),
      label: copy("Access"),
      value: copy("Confirm side-yard access"),
      status: "clarify",
    },
    {
      id: "brief-action",
      group: copy("Sales action"),
      label: copy("Next step"),
      value: copy("Schedule a discovery call"),
      status: "neutral",
    },
  ];

  return (
    <main className="bg-[#f7f3ec] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
          {copy("Example - fictional project created for demonstration purposes")}
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-normal text-stone-950 sm:text-5xl">
          {copy("A Project Brief is the sales view of the same project.")}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-stone-700">
          {copy(
            "This page uses fictional data only. It shows how confirmed answers, derived values, missing information and next action arrive in one structured document.",
          )}
        </p>
        <div className="mt-10 grid gap-6 lg:grid-cols-[0.58fr_1fr] lg:items-start">
          <ProjectCanvas
            title={copy("Project Canvas")}
            eyebrow={copy("Before sales sees it")}
            items={originCanvas}
            emptyText={copy("Project details will appear here.")}
          />
          <BriefPreview brief={defaultDeckBrief} />
        </div>
        <p className="mt-8 max-w-3xl text-[15px] leading-7 text-stone-600">
          {copy("This brief came out of eleven guided questions —")}{" "}
          <Link to="/demo/deck-project" className={INLINE_LINK}>
            {copy("walk the deck intake yourself to see how")}
          </Link>
          .
        </p>
        <div className="metre-frame mt-8 flex flex-col items-start gap-4 rounded-lg bg-[#fffdf8] p-8">
          <h2 className="text-2xl font-semibold tracking-normal text-stone-950">
            {copy("Want Project Briefs like this from your own website?")}
          </h2>
          <p className="max-w-2xl text-[15px] leading-7 text-stone-700">
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
                {copy("Try a live project intake")}
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
