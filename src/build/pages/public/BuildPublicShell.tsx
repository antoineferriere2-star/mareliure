import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Menu, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { t } from "@/build/i18n";
import { PublicLanguageSelect, PublicLocaleProvider } from "@/build/pages/public/publicLocale";
import { usePublicLocale } from "@/build/pages/public/publicLocaleContext";
import { FaqLauncher } from "@/build/pages/public/FaqLauncher";
import { usePageViewTracking } from "@/build/pages/public/usePageViewTracking";


/**
 * One entry per industry vertical Métré Build can serve. Only "published"
 * verticals appear in the nav — Pool & Spa and Windows & Doors exist today
 * only as fictional demo data (src/build/content/demoProductData.ts), not
 * as real Playbooks, so they stay out of this list until an actual Playbook
 * is ready to publish. Adding a real vertical later is a one-line change
 * here, not a nav redesign.
 */
const VERTICAL_NAV_ITEMS = [
  {
    labelKey: "navigation.deckBuilders" as const,
    to: "/deck-builders" as const,
    status: "published" as const,
  },
];

export function BuildPublicShell({
  children,
  showFaqLauncher = true,
}: {
  children: ReactNode;
  /**
   * Defaults to shown on every marketing page. Explicitly set to `false`
   * only by the actual Guided Project Intake flow (MissionRuntime) and the
   * secure Project Summary page — a persistent "Questions?" launcher there
   * would dilute the product demo itself, the same reasoning that kept
   * this feature an on-page FAQ instead of a site-wide chat widget.
   */
  showFaqLauncher?: boolean;
}) {
  return (
    <PublicLocaleProvider>
      <BuildPublicShellContent showFaqLauncher={showFaqLauncher}>
        {children}
      </BuildPublicShellContent>
    </PublicLocaleProvider>
  );
}

function BuildPublicShellContent({
  children,
  showFaqLauncher,
}: {
  children: ReactNode;
  showFaqLauncher: boolean;
}) {
  const { locale } = usePublicLocale();
  usePageViewTracking(locale);
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    ...VERTICAL_NAV_ITEMS.filter((item) => item.status === "published"),
    { labelKey: "navigation.howItWorks" as const, to: "/how-it-works" as const },
    { labelKey: "navigation.pricing" as const, to: "/pricing" as const },
    { labelKey: "navigation.exampleBrief" as const, to: "/example-project-brief" as const },
    { labelKey: "navigation.freeAudit" as const, to: "/free-inquiry-audit" as const },
    { labelKey: "navigation.contact" as const, to: "/contact" as const },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex items-center gap-3 font-semibold tracking-normal text-slate-950"
          >
            <img src="/metre-icon.svg" alt="Métré Build" className="h-8 w-8" />
            <span>Métré Build</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 lg:flex">
            {navItems.map((item) => (
              <Link key={item.to} to={item.to} className="hover:text-slate-950">
                {t(locale, item.labelKey)}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <PublicLanguageSelect />
            <Link
              to="/auth"
              className="hidden text-sm font-medium text-slate-600 hover:text-slate-950 sm:inline-flex"
            >
              {t(locale, "navigation.logIn")}
            </Link>
            <Link to="/auth">
              <Button size="sm" variant="outline" className="hidden sm:inline-flex">
                {t(locale, "navigation.createAccount")}
              </Button>
            </Link>
            <Link to="/demo/deck-project" className="hidden sm:inline-flex">
              <Button size="sm">{t(locale, "navigation.tryDemo")}</Button>
            </Link>
            <button
              type="button"
              aria-label="Menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-700 lg:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden">
            <nav className="flex flex-col gap-1 text-[15px] font-medium text-slate-700">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md px-2 py-2 hover:bg-slate-50 hover:text-slate-950"
                >
                  {t(locale, item.labelKey)}
                </Link>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4">
              <Link to="/auth" onClick={() => setMenuOpen(false)}>
                <Button variant="outline" className="w-full">
                  {t(locale, "navigation.logIn")}
                </Button>
              </Link>
              <Link to="/auth" onClick={() => setMenuOpen(false)}>
                <Button variant="outline" className="w-full">
                  {t(locale, "navigation.createAccount")}
                </Button>
              </Link>
              <Link to="/demo/deck-project" onClick={() => setMenuOpen(false)}>
                <Button className="w-full">{t(locale, "navigation.tryDemo")}</Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {children}
      {showFaqLauncher && <FaqLauncher />}
      <footer className="border-t border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_2fr] lg:px-8">
          <div>
            <div className="flex items-center gap-3 font-semibold">
              <img src="/metre-icon.svg" alt="" className="h-8 w-8" />
              Métré Build
            </div>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">
              {t(locale, "footer.description")}
            </p>
          </div>
          <div className="grid gap-4 text-sm text-slate-300 sm:grid-cols-3">
            <FooterCol title={t(locale, "footer.product")}>
              <FooterLink to="/deck-builders">{t(locale, "navigation.deckBuilders")}</FooterLink>
              <FooterLink to="/how-it-works">{t(locale, "navigation.howItWorks")}</FooterLink>
              <FooterLink to="/pricing">{t(locale, "navigation.pricing")}</FooterLink>
              <FooterLink to="/demo/deck-project">{t(locale, "footer.demo")}</FooterLink>
            </FooterCol>
            <FooterCol title={t(locale, "footer.conversion")}>
              <FooterLink to="/example-project-brief">
                {t(locale, "navigation.exampleBrief")}
              </FooterLink>
              <FooterLink to="/free-inquiry-audit">{t(locale, "navigation.freeAudit")}</FooterLink>
              <FooterLink to="/private-beta">{t(locale, "footer.setupReview")}</FooterLink>
            </FooterCol>
            <FooterCol title={t(locale, "footer.legal")}>
              <FooterLink to="/privacy">{t(locale, "footer.privacy")}</FooterLink>
              <FooterLink to="/terms">{t(locale, "footer.terms")}</FooterLink>
              <FooterLink to="/contact">{t(locale, "footer.contact")}</FooterLink>
            </FooterCol>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
        {title}
      </h2>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="block hover:text-white">
      {children}
    </Link>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  as: Heading = "h2",
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  as?: "h1" | "h2";
}) {
  return (
    <div className="max-w-3xl">
      {eyebrow && (
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
          {eyebrow}
        </p>
      )}
      <Heading className="mt-3 text-3xl font-semibold tracking-normal text-slate-950 md:text-4xl">
        {title}
      </Heading>
      {description && <p className="mt-4 text-[17px] leading-7 text-slate-700">{description}</p>}
    </div>
  );
}

export function PublicCtaBand() {
  const { locale } = usePublicLocale();

  return (
    <section className="bg-slate-950 px-4 py-16 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-200">
            {t(locale, "cta.getStarted")}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-normal md:text-4xl">
            {t(locale, "cta.title")}
          </h2>
          <p className="mt-3 max-w-xl text-[16px] leading-7 text-slate-300">
            {t(locale, "cta.description")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <a href="/free-inquiry-audit">
            <Button size="lg">{t(locale, "home.hero.secondaryCta")}</Button>
          </a>
          <a href="/demo/deck-project">
            <Button variant="link" className="h-auto p-0 text-base text-white hover:text-white">
              {t(locale, "home.hero.primaryCta")}
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
  primary,
  primaryTo,
  secondary,
  secondaryTo,
  secondaryVariant = "outline",
}: {
  eyebrow: string;
  title: string;
  description: string;
  primary: string;
  primaryTo: string;
  secondary: string;
  secondaryTo: string;
  /** A single filled button per section is the rule — the secondary CTA is
   * always demoted to either an outline button or a plain text link, never
   * a second button of equal visual weight. */
  secondaryVariant?: "outline" | "link";
}) {
  return (
    <section className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
          {eyebrow}
        </p>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">{description}</p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a href={primaryTo}>
            <Button size="lg">{primary}</Button>
          </a>
          <a href={secondaryTo}>
            {secondaryVariant === "link" ? (
              <Button variant="link" className="h-auto p-0 text-base">
                {secondary}
              </Button>
            ) : (
              <Button size="lg" variant="outline">
                {secondary}
              </Button>
            )}
          </a>
        </div>
      </div>
    </section>
  );
}

export function CheckItem({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 text-[15px] leading-6 text-slate-700">
      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-700" />
      {children}
    </div>
  );
}

export function InfoPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold tracking-normal text-slate-950">{title}</h3>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <CheckItem key={item}>{item}</CheckItem>
        ))}
      </div>
    </section>
  );
}

export function ObjectCard({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <Icon className="h-6 w-6 text-emerald-700" />
      <h3 className="mt-4 text-lg font-semibold tracking-normal">{title}</h3>
      <p className="mt-2 text-[15px] leading-6 text-slate-700">{text}</p>
    </section>
  );
}

export function StepLine({
  index,
  title,
  text,
}: {
  index: number;
  title: ReactNode;
  text: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-800">
        {index}
      </span>
      <h3 className="mt-4 font-semibold tracking-normal text-slate-950">{title}</h3>
      <p className="mt-2 text-[15px] leading-6 text-slate-700">{text}</p>
    </section>
  );
}

export function ContentBand({
  title,
  items,
  muted = false,
}: {
  title: ReactNode;
  items: string[];
  muted?: boolean;
}) {
  return (
    <section className={`${muted ? "bg-slate-50" : "bg-white"} px-4 py-16 sm:px-6 lg:px-8`}>
      <div className="mx-auto max-w-7xl">
        <SectionHeader title={title} />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <CheckItem key={item}>{item}</CheckItem>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ComparisonRow({ classic, build }: { classic: string; build: string }) {
  return (
    <div className="grid border-b border-slate-200 last:border-b-0 md:grid-cols-2">
      <div className="p-4 text-[15px] leading-6 text-slate-700">{classic}</div>
      <div className="border-t border-slate-200 bg-emerald-50 p-4 text-[15px] font-medium leading-6 text-emerald-950 md:border-l md:border-t-0">
        {build}
      </div>
    </div>
  );
}
