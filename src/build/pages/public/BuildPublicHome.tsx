import { ArrowRight, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BriefPreview } from "@/build/pages/public/BriefPreview";
import { BuildPublicShell, PublicCtaBand, SectionHeader } from "./BuildPublicShell";
import { ProjectCanvas } from "./ProjectCanvas";
import type { ProjectCanvasItem } from "./ProjectCanvasProjection";
import { MarketingProjectCanvasDemo } from "./sections/MarketingProjectCanvasDemo";
import { FaqSection } from "./sections/FaqSection";
import { HeroTransformShot } from "./sections/HeroTransformShot";
import { demoJaneMillerBrief } from "@/build/content/demoProductData";
import founderPhoto from "@/assets/antoine-ferriere.jpg.asset.json";
import { t } from "@/build/i18n";
import { publicCopy, usePublicLocale } from "@/build/pages/public/publicLocaleContext";

const STATUS_EXAMPLES = [
  ["✓", "Confirmed", "The visitor gave a clear answer."],
  ["~", "Approximate", "Useful, but still visibly approximate."],
  ["◇", "Derived", "Calculated from the project's known context."],
  ["○", "To clarify", "Unknown details become the next conversation."],
] as const;

const VERTICAL_EXAMPLES = [
  ["DECK", "dimensions · site · material"],
  ["KITCHEN", "room · inspiration · constraints"],
  ["WINDOWS", "openings · measurements · existing frames"],
  ["CUSTOM EQUIPMENT", "use · configuration · environment"],
] as const;

export function BuildPublicHome() {
  return (
    <BuildPublicShell>
      <BuildPublicHomeContent />
    </BuildPublicShell>
  );
}

function BuildPublicHomeContent() {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);

  const uncertaintyCanvas: ProjectCanvasItem[] = [
    {
      id: "known-structure",
      group: copy("Project"),
      label: copy("Structure"),
      value: copy("Existing deck"),
      status: "confirmed",
    },
    {
      id: "known-size",
      group: copy("Dimensions"),
      label: copy("Size"),
      value: copy("Approx. 252 sq ft"),
      status: "approximate",
    },
    {
      id: "known-area",
      group: copy("Derived"),
      label: copy("Area"),
      value: copy("Calculated from dimensions"),
      status: "derived",
    },
    {
      id: "known-foundation",
      group: copy("To clarify"),
      label: copy("Foundation condition"),
      value: copy("To clarify"),
      status: "clarify",
    },
  ];

  const finalCanvas: ProjectCanvasItem[] = [
    {
      id: "final-project",
      group: copy("Project"),
      label: copy("Project"),
      value: copy("Deck replacement"),
      status: "confirmed",
    },
    {
      id: "final-material",
      group: copy("Preferences"),
      label: copy("Material"),
      value: copy("Composite decking"),
      status: "approximate",
    },
    {
      id: "final-size",
      group: copy("Dimensions"),
      label: copy("Approximate area"),
      value: copy("320 sq ft"),
      status: "derived",
    },
    {
      id: "final-open",
      group: copy("Next to understand"),
      label: copy("Access"),
      value: copy("Confirm side-yard access"),
      status: "clarify",
    },
  ];

  return (
    <main className="bg-[#f7f3ec] text-stone-950">
      <section className="overflow-hidden px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[minmax(0,0.82fr)_1.18fr] lg:gap-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700">
              {t(locale, "home.hero.eyebrow")}
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-normal text-stone-950 sm:text-5xl lg:text-7xl">
              {t(locale, "home.hero.title")}
            </h1>
            <p className="mt-5 max-w-2xl text-[18px] leading-8 text-stone-700">
              {t(locale, "home.hero.description")}
            </p>
            <p className="mt-4 max-w-2xl text-xl font-semibold leading-8 text-stone-950">
              {t(locale, "home.hero.kicker")}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <a href="/demo/deck-project">
                <Button size="lg">
                  {t(locale, "home.hero.primaryCta")}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
              </a>
              <a
                href="/free-inquiry-audit"
                className="text-base font-medium text-stone-700 underline underline-offset-4 hover:text-stone-950"
              >
                {t(locale, "home.hero.secondaryCta")}
              </a>
            </div>
            <p className="mt-4 max-w-xl text-[13px] leading-5 text-stone-500">
              {t(locale, "home.hero.disclaimer")}
            </p>
          </div>
          <HeroTransformShot brief={demoJaneMillerBrief} />
        </div>
      </section>

      <section className="bg-[#fffdf8] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow={copy("Watch the project take shape")}
            title={copy("The customer answers one thing. The project gets clearer.")}
            description={copy(
              "This is a front-end demonstration only: no backend, no storage, no AI call. It mirrors how the real intake keeps the Project Canvas visible while answers arrive.",
            )}
          />
          <div className="mt-10">
            <MarketingProjectCanvasDemo />
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.78fr_1fr] lg:items-start">
          <div>
            <SectionHeader
              eyebrow={copy("Know what you know")}
              title={copy("Métré does not turn uncertainty into fake certainty.")}
              description={copy(
                "A useful sales conversation needs facts, estimates and open questions to stay visibly different.",
              )}
            />
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {STATUS_EXAMPLES.map(([mark, title, text]) => (
                <div key={title} className="border-t border-stone-300 pt-4">
                  <p className="text-2xl text-stone-950">{mark}</p>
                  <h3 className="mt-2 text-base font-semibold text-stone-950">{copy(title)}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{copy(text)}</p>
                </div>
              ))}
            </div>
          </div>
          <ProjectCanvas
            title={copy("Project Canvas")}
            eyebrow={copy("Example project")}
            items={uncertaintyCanvas}
            emptyText={copy("Project details will appear here.")}
          />
        </div>
      </section>

      <section className="bg-stone-950 px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-200">
              {copy("Customer project -> sales action")}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal text-white md:text-5xl">
              {copy("The same project becomes a Project Brief your team can use.")}
            </h2>
            <p className="mt-4 text-[17px] leading-7 text-stone-300">
              {copy(
                "The visitor does not submit a loose message. Métré reorganizes the captured project into summary, facts, assumptions, missing information and next action.",
              )}
            </p>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(280px,0.72fr)_auto_minmax(0,1fr)] lg:items-center">
            <ProjectCanvas
              title={copy("Visitor Project Canvas")}
              eyebrow={copy("Before submission")}
              items={finalCanvas}
              emptyText={copy("Project details will appear here.")}
              className="text-stone-950"
            />
            <div
              className="hidden text-center text-4xl text-emerald-300 lg:block"
              aria-hidden="true"
            >
              →
            </div>
            <div className="min-w-0">
              <BriefPreview brief={demoJaneMillerBrief} compact />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#fffdf8] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.7fr_1fr] lg:items-start">
          <SectionHeader
            eyebrow={copy("One system. Many projects.")}
            title={copy(
              "Built for businesses that need to understand the project before they can sell it.",
            )}
            description={copy(
              "The live public demo is deck-focused today. The system itself is for configurable project businesses where the first conversation depends on context.",
            )}
          />
          <div className="divide-y divide-stone-200 border-y border-stone-200">
            {VERTICAL_EXAMPLES.map(([name, details]) => (
              <div
                key={name}
                className="grid gap-2 py-5 sm:grid-cols-[minmax(120px,0.32fr)_1fr] sm:items-baseline"
              >
                <p className="text-sm font-semibold tracking-[0.18em] text-stone-950">{name}</p>
                <p className="text-[17px] leading-7 text-stone-600">{details}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
              {copy("Built from field experience")}
            </p>
            <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-normal text-stone-950 md:text-3xl">
              {copy(
                "Built by a construction entrepreneur who got tired of starting every sales call from scratch.",
              )}
            </h2>
            <p className="mt-4 max-w-3xl text-[16px] leading-7 text-stone-700">
              {copy(
                "Métré Build was founded by Antoine Ferrière, a construction entrepreneur with more than 15 years of experience across timber construction, renovation and project delivery.",
              )}
            </p>
          </div>
          <a
            href="https://www.linkedin.com/in/antoine-ferriere-53113048/"
            target="_blank"
            rel="noopener noreferrer"
            className="metre-frame flex items-center gap-4 rounded-lg bg-[#fffdf8] p-4 transition hover:bg-white"
          >
            <img
              src={founderPhoto.url}
              alt="Antoine Ferrière, founder of Métré Build"
              loading="lazy"
              className="h-12 w-12 shrink-0 rounded-full object-cover"
            />
            <span>
              <span className="block text-sm font-semibold text-stone-950">Antoine Ferrière</span>
              <span className="block text-xs text-stone-500">{copy("Founder, Métré Build")}</span>
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline">
                <Linkedin className="h-3 w-3" aria-hidden="true" />
                {copy("View on LinkedIn")}
              </span>
            </span>
          </a>
        </div>
      </section>

      <section className="bg-[#fffdf8] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 border-y border-stone-200 py-8 md:grid-cols-3">
          {[
            ["Playbook", "How Métré knows what to understand."],
            ["Project Intake", "How the customer builds the project."],
            ["Project Brief", "What sales receives before the first call."],
          ].map(([title, text]) => (
            <div key={title} className="min-w-0">
              <h3 className="text-lg font-semibold tracking-normal text-stone-950">{title}</h3>
              <p className="mt-2 text-[15px] leading-6 text-stone-600">{copy(text)}</p>
            </div>
          ))}
        </div>
      </section>

      <PublicCtaBand />
      <FaqSection />
    </main>
  );
}
