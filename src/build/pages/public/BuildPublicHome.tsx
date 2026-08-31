import { ArrowRight, Linkedin } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CONFIDENCE_LABEL_TEXT } from "@/build/schema/briefLabels";
import type { ProjectBrief, BriefLine } from "@/build/schema/brief";
import { BuildPublicShell, SectionHeader } from "./BuildPublicShell";
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
  ["✓", "Confirmed", "Provided directly by the customer."],
  ["~", "Approximate", "Useful, but not exact yet."],
  ["◇", "Derived", "Calculated from known information."],
  ["○", "To clarify", "Still needs an answer."],
] as const;

type VerticalKey = "deck" | "kitchen" | "windows" | "equipment";

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
  const [activeVertical, setActiveVertical] = useState<VerticalKey>("deck");

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

  const verticals: Array<{
    id: VerticalKey;
    name: string;
    details: string;
    items: ProjectCanvasItem[];
  }> = [
    {
      id: "deck",
      name: "DECK",
      details: "site · dimensions · material · access",
      items: [
        {
          id: "deck-site",
          group: copy("Site"),
          label: copy("Existing"),
          value: copy("Raised timber deck"),
          status: "confirmed",
        },
        {
          id: "deck-dimensions",
          group: copy("Dimensions"),
          label: copy("Area"),
          value: copy("Approx. 252 sq ft"),
          status: "approximate",
        },
        {
          id: "deck-access",
          group: copy("To clarify"),
          label: copy("Access"),
          value: copy("Side-yard access"),
          status: "clarify",
        },
      ],
    },
    {
      id: "kitchen",
      name: "KITCHEN",
      details: "room · layout · inspiration · constraints",
      items: [
        {
          id: "kitchen-room",
          group: copy("Room"),
          label: copy("Room"),
          value: copy("Kitchen"),
          status: "confirmed",
        },
        {
          id: "kitchen-layout",
          group: copy("Layout"),
          label: copy("Layout"),
          value: copy("Galley to review"),
          status: "approximate",
        },
        {
          id: "kitchen-constraints",
          group: copy("To clarify"),
          label: copy("Constraints"),
          value: copy("Plumbing and wall changes"),
          status: "clarify",
        },
      ],
    },
    {
      id: "windows",
      name: "WINDOWS",
      details: "openings · dimensions · existing · finish",
      items: [
        {
          id: "windows-openings",
          group: copy("Openings"),
          label: copy("Openings"),
          value: copy("8 existing windows"),
          status: "confirmed",
        },
        {
          id: "windows-dimensions",
          group: copy("Dimensions"),
          label: copy("Sizes"),
          value: copy("Mixed sizes"),
          status: "approximate",
        },
        {
          id: "windows-finish",
          group: copy("To clarify"),
          label: copy("Finish"),
          value: copy("Interior trim condition"),
          status: "clarify",
        },
      ],
    },
    {
      id: "equipment",
      name: "CUSTOM EQUIPMENT",
      details: "use · configuration · environment · constraints",
      items: [
        {
          id: "equipment-use",
          group: copy("Use"),
          label: copy("Use"),
          value: copy("Commercial workspace"),
          status: "confirmed",
        },
        {
          id: "equipment-config",
          group: copy("Configuration"),
          label: copy("Configuration"),
          value: copy("Made-to-order"),
          status: "approximate",
        },
        {
          id: "equipment-environment",
          group: copy("To clarify"),
          label: copy("Environment"),
          value: copy("Site constraints"),
          status: "clarify",
        },
      ],
    },
  ];
  const currentVertical =
    verticals.find((vertical) => vertical.id === activeVertical) ?? verticals[0];

  return (
    <main className="bg-[#f7f3ec] text-stone-950">
      <section className="overflow-hidden px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[minmax(0,0.82fr)_1.18fr] lg:gap-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700">
              {t(locale, "home.hero.eyebrow")}
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-normal text-stone-950 sm:text-5xl lg:text-5xl xl:text-6xl">
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
              "A single answer lands as project information, while the whole project stays visible.",
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
            <div className="mt-10 divide-y divide-stone-300 border-y border-stone-300">
              {STATUS_EXAMPLES.map(([mark, title, text]) => (
                <div
                  key={title}
                  className="grid gap-3 py-5 sm:grid-cols-[88px_minmax(0,0.48fr)_1fr] sm:items-baseline"
                >
                  <p className="text-3xl font-semibold text-stone-950" aria-hidden="true">
                    {mark}
                  </p>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-950">
                    {copy(title)}
                  </h3>
                  <p className="text-[16px] leading-7 text-stone-600">{copy(text)}</p>
                </div>
              ))}
            </div>
          </div>
          <ProjectCanvas
            title={copy("Project Canvas")}
            eyebrow={copy("Example project")}
            items={uncertaintyCanvas}
            emptyText={copy("Project details will appear here.")}
            density="marketing"
            maxItems={4}
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
              density="marketing"
              maxItems={4}
            />
            <div
              className="hidden text-center text-4xl text-emerald-300 lg:block"
              aria-hidden="true"
            >
              →
            </div>
            <div className="min-w-0">
              <SalesBriefSnapshot brief={demoJaneMillerBrief} />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#fffdf8] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1fr)] lg:items-start">
          <div>
            <SectionHeader
              eyebrow={copy("One system. Many projects.")}
              title={copy("Same principle. Different project.")}
              description={copy(
                "The live public demo is deck-focused today. The same Project Canvas model fits businesses where the first conversation depends on context.",
              )}
            />
            <div className="mt-10 divide-y divide-stone-200 border-y border-stone-200">
              {verticals.map((vertical) => (
                <button
                  key={vertical.id}
                  type="button"
                  aria-pressed={vertical.id === currentVertical.id}
                  onClick={() => setActiveVertical(vertical.id)}
                  className="grid w-full gap-2 py-5 text-left transition hover:text-stone-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:grid-cols-[minmax(130px,0.34fr)_1fr] sm:items-baseline"
                >
                  <span
                    className={`text-sm font-semibold tracking-[0.18em] ${
                      vertical.id === currentVertical.id ? "text-emerald-700" : "text-stone-950"
                    }`}
                  >
                    {vertical.name}
                  </span>
                  <span className="text-[17px] leading-7 text-stone-600">{vertical.details}</span>
                </button>
              ))}
            </div>
            <p className="mt-8 text-2xl font-semibold leading-tight text-stone-950">
              {copy("Same system. Different project.")}
            </p>
          </div>
          <div className="lg:sticky lg:top-28">
            <ProjectCanvas
              key={currentVertical.id}
              title={copy("Project Canvas")}
              eyebrow={currentVertical.name}
              items={currentVertical.items}
              emptyText={copy("Project details will appear here.")}
              density="marketing"
              maxItems={3}
            />
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 border-y border-stone-300 py-8 lg:grid-cols-[1fr_0.62fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
              {copy("Built from field experience")}
            </p>
            <blockquote className="mt-3 max-w-3xl text-2xl font-semibold leading-tight tracking-normal text-stone-950 md:text-3xl">
              “
              {copy(
                "Sales calls should start with the project already visible, not with another blank discovery call.",
              )}
              ”
            </blockquote>
            <p className="mt-4 max-w-3xl text-[15px] leading-7 text-stone-700">
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
        <div className="mx-auto max-w-7xl border-y border-stone-200 py-10">
          <div className="grid gap-5 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
            {[
              ["Playbook", "How Métré knows what to understand."],
              ["Project Intake", "How the customer builds the project."],
              ["Project Brief", "What sales receives before the first call."],
            ].map(([title, text], index) => (
              <div key={title} className="contents">
                <div className="min-w-0">
                  <h3 className="text-2xl font-semibold tracking-normal text-stone-950">{title}</h3>
                  <p className="mt-2 text-[15px] leading-6 text-stone-600">{copy(text)}</p>
                </div>
                {index < 2 && (
                  <div className="text-2xl text-emerald-700 md:text-center" aria-hidden="true">
                    <span className="md:hidden">↓</span>
                    <span className="hidden md:inline">→</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <WebsiteToIntakeCta />
      <FaqSection />
    </main>
  );
}

function SalesBriefSnapshot({ brief }: { brief: ProjectBrief }) {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);
  const projectLines = brief.confirmedInformation.slice(0, 2);
  const dimensionLines = brief.assumptionsAndCalculated.slice(0, 1);
  const missingLines = brief.missingInformation.slice(0, 2);

  return (
    <article className="rounded-lg border border-stone-700 bg-white p-5 text-stone-950 sm:p-6 lg:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
        {copy("Project Brief")}
      </p>
      <h3 className="mt-2 text-2xl font-semibold tracking-normal text-stone-950">
        {copy(brief.missionName)}
      </h3>
      <div className="mt-5 grid gap-3 border-y border-stone-200 py-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
            {copy("Confidence")}
          </p>
          <p className="mt-1 text-lg font-semibold text-stone-950">
            {copy(CONFIDENCE_LABEL_TEXT[brief.confidence.label])}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
            {copy("View")}
          </p>
          <p className="mt-1 text-lg font-semibold text-stone-950">{copy("Sales-ready")}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-5">
        <BriefSnapshotGroup title={copy("Project")} lines={projectLines} />
        <BriefSnapshotGroup title={copy("Dimensions")} lines={dimensionLines} />
        <BriefSnapshotGroup title={copy("Missing")} lines={missingLines} />
      </div>
      <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
          {copy("Recommended next action")}
        </p>
        <p className="mt-2 text-[15px] leading-6 text-emerald-950">
          {copy(brief.suggestedNextAction.value)}
        </p>
      </div>
      <a
        href="/example-project-brief"
        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline"
      >
        {copy("View a complete Project Brief")}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </a>
    </article>
  );
}

function BriefSnapshotGroup({ title, lines }: { title: string; lines: BriefLine[] }) {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);

  return (
    <section>
      <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{title}</h4>
      {lines.length === 0 ? (
        <p className="mt-2 text-[15px] leading-6 text-stone-600">{copy("None provided.")}</p>
      ) : (
        <dl className="mt-2 space-y-2">
          {lines.map((line) => (
            <div key={`${line.label}-${line.value}`} className="text-[15px] leading-6">
              <dt className="inline font-semibold text-stone-950">{copy(line.label)}: </dt>
              <dd className="inline text-stone-700">{copy(line.value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function WebsiteToIntakeCta() {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);
  const ctaItems: ProjectCanvasItem[] = [
    {
      id: "cta-business",
      group: copy("Website"),
      label: copy("Business"),
      value: copy("Detected from your site"),
      status: "derived",
    },
    {
      id: "cta-intake",
      group: copy("Project Intake"),
      label: copy("First intake"),
      value: copy("Prepared for review"),
      status: "approximate",
    },
    {
      id: "cta-next",
      group: copy("Next to understand"),
      label: copy("Sales questions"),
      value: copy("Scope · site · budget"),
      status: "neutral",
    },
  ];

  return (
    <section className="bg-stone-950 px-4 py-16 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,0.72fr)_auto_minmax(0,1fr)] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-200">
            {copy("Start from your website")}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-normal text-white md:text-5xl">
            {copy("Your website can become the first project intake.")}
          </h2>
          <p className="mt-4 max-w-xl text-[17px] leading-7 text-stone-300">
            {copy(
              "Analyze your public page first. Métré will show what it can understand before you create an account.",
            )}
          </p>
          <a href="/free-inquiry-audit" className="mt-7 inline-flex">
            <Button size="lg">
              {copy("Analyze my website")}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </a>
        </div>
        <div className="hidden text-center text-4xl text-emerald-300 lg:block" aria-hidden="true">
          →
        </div>
        <div className="grid gap-4">
          <div className="rounded-lg border border-stone-700 bg-stone-900 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
              {copy("Your website")}
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">yourcompany.com</p>
          </div>
          <ProjectCanvas
            title={copy("Your first Project Intake")}
            eyebrow="Métré"
            items={ctaItems}
            emptyText={copy("Project details will appear here.")}
            density="marketing"
            maxItems={3}
            className="text-stone-950"
          />
        </div>
      </div>
    </section>
  );
}
