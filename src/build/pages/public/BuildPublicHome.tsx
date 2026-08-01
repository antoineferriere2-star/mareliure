import { ArrowRight, FileText, Layers3, Sparkles, Users, Briefcase, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BuildPublicShell,
  CheckItem,
  InfoPanel,
  ObjectCard,
  PublicCtaBand,
  SectionHeader,
  StepLine,
} from "@/build/pages/public/BuildPublicShell";
import { HeroTransformShot } from "@/build/pages/public/sections/HeroTransformShot";
import { DossiersListPreview } from "@/build/pages/public/AdminPreviewShots";
import { InspirationPreview } from "@/build/pages/public/sections/InspirationSection";
import { BeforeAfterSection } from "@/build/pages/public/sections/BeforeAfterSection";
import { InsideMetreBuildSection } from "@/build/pages/public/sections/InsideMetreBuildSection";
import { FaqSection } from "@/build/pages/public/sections/FaqSection";
import { demoJaneMillerBrief, demoDossiersRows } from "@/build/content/demoProductData";
import founderPhoto from "@/assets/antoine-ferriere.jpg.asset.json";
import { t, type SupportedLocale } from "@/build/i18n";
import { publicCopy, usePublicLocale } from "@/build/pages/public/publicLocaleContext";

const HOME_PROBLEM_ITEMS: Record<
  SupportedLocale,
  {
    classic: string[];
    missing: string[];
  }
> = {
  "en-US": {
    classic: ["Name", "Email", "Phone number", "A vague free-text message"],
    missing: [
      "Dimensions",
      "Photos",
      "Budget",
      "Timeline",
      "Constraints",
      "Missing information",
      "Next commercial action",
    ],
  },
  "es-US": {
    classic: ["Nombre", "Email", "Teléfono", "Un mensaje libre y poco claro"],
    missing: [
      "Dimensiones",
      "Fotos",
      "Presupuesto",
      "Plazo",
      "Restricciones",
      "Información pendiente",
      "Siguiente acción comercial",
    ],
  },
};

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
  const problemItems = HOME_PROBLEM_ITEMS[locale];

  return (
    <main>
      {/* HERO */}
      <section className="overflow-hidden bg-slate-50 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[minmax(0,0.85fr)_1.25fr] lg:gap-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
              {t(locale, "home.hero.eyebrow")}
            </p>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl lg:text-5xl">
              {t(locale, "home.hero.title")}
            </h1>
            <p className="mt-4 max-w-2xl text-[17px] leading-7 text-slate-700">
              {t(locale, "home.hero.description")}
            </p>
            <p className="mt-3 max-w-2xl text-[15px] font-medium leading-6 text-slate-600">
              {t(locale, "home.hero.kicker")}
            </p>
            <p className="mt-2 max-w-2xl text-[13px] leading-5 text-slate-500">
              {t(locale, "home.hero.deckIntro")}{" "}
              <span
                className="cursor-help underline decoration-dotted decoration-slate-400 underline-offset-4"
                title={t(locale, "home.hero.playbookTooltip")}
              >
                Playbook
              </span>
              .
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <a href="/demo/deck-project">
                <Button size="lg">
                  {t(locale, "home.hero.primaryCta")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
              <a href="/free-inquiry-audit">
                <Button variant="link" className="h-auto p-0 text-base">
                  {t(locale, "home.hero.secondaryCta")}
                </Button>
              </a>
            </div>
            <p className="mt-4 max-w-2xl text-[13px] leading-5 text-slate-500">
              {t(locale, "home.hero.disclaimer")}
            </p>
          </div>
          <HeroTransformShot brief={demoJaneMillerBrief} />
        </div>
      </section>

      {/* PROBLEM */}
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            title={t(locale, "home.problem.title")}
            description={t(locale, "home.problem.description")}
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <InfoPanel
              title={t(locale, "home.problem.classicTitle")}
              items={problemItems.classic}
            />
            <InfoPanel
              title={t(locale, "home.problem.missingTitle")}
              items={problemItems.missing}
            />
          </div>
        </div>
      </section>

      {/* BEFORE / AFTER (incl. honest-discovery proof points) */}
      <BeforeAfterSection />

      {/* EASIER FOR CUSTOMERS, MORE USEFUL FOR SALES (incl. inspiration photo) */}
      <section className="bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow={copy("Two sides of the same journey")}
            title={copy("Easier for your customers. More useful for your sales team.")}
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2 md:items-start">
            <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <Users className="h-6 w-6 text-emerald-700" />
              <h3 className="mt-4 text-lg font-semibold tracking-normal text-slate-950">
                {copy("For your customers")}
              </h3>
              <div className="mt-4 space-y-2">
                {[
                  "No technical vocabulary required",
                  "Guided questions and visual choices",
                  "“Not sure” options when details are unknown",
                  "Photos instead of long explanations",
                  "A clear recap before submission",
                ].map((item) => (
                  <CheckItem key={item}>{copy(item)}</CheckItem>
                ))}
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {copy("Live example — start from a photo")}
              </p>
              <div className="mt-2">
                <InspirationPreview />
              </div>
            </div>
            <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <Briefcase className="h-6 w-6 text-emerald-700" />
              <h3 className="mt-4 text-lg font-semibold tracking-normal text-slate-950">
                {copy("For your sales team")}
              </h3>
              <div className="mt-4 space-y-2">
                {[
                  "Structured project context",
                  "Confirmed details separated from assumptions",
                  "Photos, budget and timing in one place",
                  "Missing information clearly identified",
                  "A suggested next action",
                ].map((item) => (
                  <CheckItem key={item}>{copy(item)}</CheckItem>
                ))}
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {copy("Live example")}
              </p>
              <div className="mt-2">
                <DossiersListPreview rows={demoDossiersRows.slice(0, 2)} />
              </div>
            </div>
          </div>
          <p className="mt-8 text-center text-[16px] font-medium leading-7 text-slate-700">
            {copy("Help customers explain the project. Help sales teams act on it.")}
          </p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow={copy("How it works")}
            title={copy("A simple path from inquiry to commercial context.")}
          />
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {[
              {
                title: (
                  <>
                    {copy("Choose or confirm the right")}{" "}
                    <span
                      className="cursor-help underline decoration-dotted decoration-slate-400 underline-offset-4"
                      title={copy("The guided experience completed by the customer.")}
                    >
                      {copy("Project Intake")}
                    </span>
                    .
                  </>
                ),
                text: "Start with an industry-specific discovery method, or let us match one from your website.",
              },
              {
                title: copy("Add it to your website."),
                text: "Publish it with a link or a small website snippet.",
              },
              {
                title: copy("Receive structured Project Briefs."),
                text: "Review a structured brief before the first call.",
              },
            ].map((step, index) => (
              <StepLine
                key={step.text}
                index={index + 1}
                title={step.title}
                text={copy(step.text)}
              />
            ))}
          </div>
          <p className="mt-4 text-[14px] leading-6 text-slate-600">
            {copy(
              "Every Project Brief carries its own qualification confidence and lists exactly what is still missing — never a fake certainty.",
            )}
          </p>
        </div>
      </section>

      <InsideMetreBuildSection />

      {/* POSITIONING */}
      <section className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader
            eyebrow={copy("Product")}
            title={copy("Not a generic form builder.")}
            description={copy(
              "Métré Build uses industry Playbooks to guide customers and turn incomplete inquiries into structured, actionable Project Briefs.",
            )}
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <ObjectCard
              icon={Layers3}
              title={copy("Playbook")}
              text={copy("A reusable industry-specific project discovery method.")}
            />
            <ObjectCard
              icon={Sparkles}
              title={copy("Guided Project Intake")}
              text={copy("The guided experience completed by the customer.")}
            />
            <ObjectCard
              icon={FileText}
              title={copy("Project Brief")}
              text={copy("The structured, actionable output received by the sales team.")}
            />
          </div>
          <h3 className="mt-10 text-xl font-semibold tracking-normal text-slate-950">
            {copy("The missing layer between forms and configurators")}
          </h3>
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-1 border-b border-slate-200 bg-slate-100 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 md:grid-cols-3">
              <div className="p-4">{copy("Generic form")}</div>
              <div className="border-t border-slate-200 bg-emerald-100 p-4 text-emerald-900 md:border-l md:border-t-0">
                Métré Build
              </div>
              <div className="border-t border-slate-200 p-4 md:border-l md:border-t-0">
                {copy("Custom configurator")}
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
                <div className="p-4 text-[15px] leading-6 text-slate-700">{copy(a)}</div>
                <div className="border-t border-slate-200 bg-emerald-50 p-4 text-[15px] font-medium leading-6 text-emerald-950 md:border-l md:border-t-0">
                  {copy(b)}
                </div>
                <div className="border-t border-slate-200 p-4 text-[15px] leading-6 text-slate-700 md:border-l md:border-t-0">
                  {copy(c)}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[15px] leading-7 text-slate-700">
            {copy(
              "Métré Build helps customers clarify their project without forcing your business to build a custom configurator.",
            )}
          </p>
        </div>
      </section>

      {/* TRUST / FOUNDER */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
            {copy("Built from field experience")}
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950 md:text-3xl">
            {copy(
              "Built by a construction entrepreneur who got tired of starting every sales call from scratch.",
            )}
          </h2>
          <p className="mt-4 text-[16px] leading-7 text-slate-700">
            {copy(
              "Métré Build was founded by Antoine Ferrière, a construction entrepreneur with more than 15 years of experience across timber construction, renovation and project delivery.",
            )}
          </p>
          <a
            href="https://www.linkedin.com/in/antoine-ferriere-53113048/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:shadow-md"
          >
            <img
              src={founderPhoto.url}
              alt="Antoine Ferrière, founder of Métré Build"
              loading="lazy"
              className="h-12 w-12 shrink-0 rounded-full object-cover"
            />

            <div>
              <p className="text-sm font-semibold text-slate-950">Antoine Ferrière</p>
              <p className="text-xs text-slate-500">{copy("Founder, Métré Build")}</p>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline">
                <Linkedin className="h-3 w-3" />
                {copy("View on LinkedIn")}
              </span>
            </div>
          </a>
        </div>
      </section>

      {/* OFFER / CTA */}
      <PublicCtaBand />

      {/* FAQ */}
      <FaqSection />
    </main>
  );
}
