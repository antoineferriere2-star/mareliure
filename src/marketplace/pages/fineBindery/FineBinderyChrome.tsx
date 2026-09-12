/**
 * Fine Bindery's own header, footer and CTA — never LandingChrome.tsx's:
 * that file's nav, wordmark and footer are French and read "Ma Reliure",
 * which would be exactly the confusion a second brand exists to avoid.
 * SHELL and SectionHead (LandingChrome.tsx) are reused as-is — they are
 * brand-neutral layout primitives, and building a second copy of them was
 * exactly the duplication the multi-brand audit (12 September 2026) ruled
 * out.
 */
import { Link } from "@tanstack/react-router";
import { FINE_BINDERY_PUBLIC_TOKEN } from "@/build/constants";
import { MARKETPLACE_BRAND_CONFIGS } from "@/marketplace/brand/brandConfig";

const BRAND = MARKETPLACE_BRAND_CONFIGS.FINE_BINDERY;

const INTAKE_PARAMS = { publicToken: FINE_BINDERY_PUBLIC_TOKEN } as const;
export const INTAKE_LABEL = "Start your project";

export function FineBinderyIntakeCta({
  variant = "solid",
  size = "default",
}: {
  variant?: "solid" | "outline";
  size?: "default" | "compact";
}) {
  const base =
    "inline-flex items-center justify-center rounded-[2px] font-semibold tracking-[0.01em] transition-colors duration-200";
  const sizes = {
    default: "px-7 py-4 text-[0.9375rem]",
    compact: "px-4 py-2.5 text-[0.8125rem] sm:px-5 sm:py-3",
  } as const;
  const skins = {
    solid: "bg-mr-ink text-mr-paper hover:bg-mr-walnut",
    outline: "border border-mr-ink/25 text-mr-ink hover:border-mr-ink hover:bg-mr-ink/[0.04]",
  } as const;
  return (
    <Link
      to="/m/$publicToken"
      params={INTAKE_PARAMS}
      className={`${base} ${sizes[size]} ${skins[variant]}`}
    >
      {INTAKE_LABEL}
    </Link>
  );
}

function Wordmark() {
  return (
    <span className="inline-flex flex-col leading-none">
      <span className="mr-title text-[1.35rem] text-mr-ink sm:text-[1.5rem]">
        {BRAND.displayName}
      </span>
      <span aria-hidden="true" className="mt-1.5 h-px w-8 bg-mr-brass" />
    </span>
  );
}

const NAV = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#offers", label: "What we do" },
  { href: "#workshops", label: "Our workshops" },
  { href: "#faq", label: "FAQ" },
] as const;

export function FineBinderyHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-mr-rule/70 bg-mr-paper">
      <div className="mx-auto flex max-w-[78rem] items-center justify-between gap-6 px-5 py-4 sm:px-8 sm:py-5">
        <a href="#top" className="shrink-0" aria-label={`${BRAND.displayName} — home`}>
          <Wordmark />
        </a>

        <nav aria-label="Main navigation" className="hidden lg:block">
          <ul className="flex items-center gap-9">
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="mr-tap mr-small text-mr-graphite underline-offset-[6px] transition-colors hover:text-mr-ink hover:underline"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-4 sm:gap-5">
          <a
            href="/auth"
            className="mr-tap mr-small shrink-0 text-mr-graphite underline-offset-[6px] transition-colors hover:text-mr-ink hover:underline"
          >
            Sign in
          </a>
          <FineBinderyIntakeCta variant="outline" size="compact" />
        </div>
      </div>
    </header>
  );
}

/**
 * Legal pages exist only in French today (/mentions-legales,
 * /confidentialite, /conditions) — a real, flagged gap, not something to
 * paper over with fabricated English text. Linking to them plainly, in
 * English labels, is more honest than inventing a translation of a legal
 * document no one has reviewed.
 */
const LEGAL_LINKS = [
  { href: "/mentions-legales", label: "Legal notice (French)" },
  { href: "/confidentialite", label: "Privacy (French)" },
  { href: "/conditions", label: "Terms (French)" },
] as const;

export function FineBinderyFooter() {
  return (
    <footer className="border-t border-mr-rule bg-mr-paper-warm">
      <div className="mx-auto max-w-[80rem] px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mr-small mt-6 max-w-[22rem] text-mr-graphite">
              The international concierge for exceptional French bookbinding. Bookbinding,
              restoration and bespoke creation, entrusted to independent workshops in France.
            </p>
          </div>

          <nav aria-label="Fine Bindery">
            <h2 className="mr-eyebrow text-mr-graphite">Fine Bindery</h2>
            <ul className="mr-small mt-5 space-y-3">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="mr-tap text-mr-graphite underline-offset-4 hover:text-mr-ink hover:underline"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="mr-eyebrow text-mr-graphite">Information</h2>
            <ul className="mr-small mt-5 space-y-3 text-mr-graphite">
              {LEGAL_LINKS.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="mr-tap text-mr-graphite underline-offset-4 hover:text-mr-ink hover:underline"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mr-small mt-14 border-t border-mr-rule pt-8 text-mr-graphite">
          {BRAND.displayName} — French bookbinding, restoration and craftsmanship, by independent
          artisans.
        </p>
      </div>
    </footer>
  );
}
