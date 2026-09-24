import { MARKETPLACE_BRAND_CONFIGS } from "@/marketplace/brand/brandConfig";
import { FineBinderyLanguageSwitch } from "@/marketplace/i18n/FineBinderyLanguageSwitch";
import { fineBinderyCopy } from "@/marketplace/i18n/fineBinderyCopy";
import { fineBinderyDirectoryPath, fineBinderyHomePath, fineBinderyProjectPath, type FineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";

const BRAND = MARKETPLACE_BRAND_CONFIGS.FINE_BINDERY;

export function FineBinderyIntakeCta({ locale, slug, variant = "solid", size = "default" }: { locale: FineBinderyLocale; slug?: string; variant?: "solid" | "outline"; size?: "default" | "compact" }) {
  const copy = fineBinderyCopy(locale);
  const base = "inline-flex min-h-11 items-center justify-center rounded-[2px] text-center font-semibold tracking-[0.01em] transition-colors duration-200";
  const sizes = { default: "px-7 py-3.5 text-[0.9375rem]", compact: "px-4 py-2.5 text-[0.8125rem] sm:px-5" } as const;
  const skins = { solid: "bg-mr-ink text-mr-paper hover:bg-mr-walnut", outline: "border border-mr-ink/25 text-mr-ink hover:border-mr-ink hover:bg-mr-ink/[0.04]" } as const;
  return <a href={fineBinderyProjectPath(locale, slug)} className={`${base} ${sizes[size]} ${skins[variant]}`}>{copy.common.start}</a>;
}

function Wordmark({ locale }: { locale: FineBinderyLocale }) {
  return <a href={fineBinderyHomePath(locale)} className="inline-flex shrink-0 flex-col leading-none" aria-label={`${BRAND.displayName} — home`}><span className="mr-title text-[1.35rem] text-mr-ink sm:text-[1.5rem]">{BRAND.displayName}</span><span aria-hidden="true" className="mt-1.5 h-px w-8 bg-mr-brass" /></a>;
}

function navigation(locale: FineBinderyLocale) {
  const copy = fineBinderyCopy(locale); const home = fineBinderyHomePath(locale);
  return [{ href: `${home}#how-it-works`, label: copy.nav.how }, { href: `${home}#offers`, label: copy.nav.services }, { href: fineBinderyDirectoryPath(locale), label: copy.nav.workshops }, { href: `${home}#faq`, label: copy.nav.faq }];
}

export function FineBinderyHeader({ locale }: { locale: FineBinderyLocale }) {
  const copy = fineBinderyCopy(locale); const nav = navigation(locale);
  return <header className="sticky top-0 z-40 border-b border-mr-rule/70 bg-mr-paper/95 backdrop-blur"><div className="mx-auto flex max-w-[78rem] flex-wrap items-center justify-between gap-x-5 gap-y-3 px-5 py-3 sm:px-8 lg:flex-nowrap lg:py-4"><Wordmark locale={locale} /><nav aria-label="Fine Bindery" className="order-3 w-full overflow-x-auto lg:order-none lg:w-auto"><ul className="flex min-w-max items-center gap-6 pb-1 lg:gap-8 lg:pb-0">{nav.map((item) => <li key={item.href}><a href={item.href} className="mr-tap mr-small text-mr-graphite underline-offset-[6px] hover:text-mr-ink hover:underline">{item.label}</a></li>)}</ul></nav><div className="flex items-center gap-2 sm:gap-3"><FineBinderyLanguageSwitch locale={locale} label={copy.nav.language} /><a href={`/auth?locale=${locale}`} className="mr-tap mr-small hidden shrink-0 text-mr-graphite underline-offset-[6px] hover:text-mr-ink hover:underline sm:inline-flex">{copy.nav.signIn}</a><span className="hidden xl:inline-flex"><FineBinderyIntakeCta locale={locale} variant="outline" size="compact" /></span></div></div></header>;
}

export function FineBinderyFooter({ locale }: { locale: FineBinderyLocale }) {
  const copy = fineBinderyCopy(locale); const nav = navigation(locale);
  const legal = [{ href: "/legal-notice", label: copy.footer.legal }, { href: "/privacy-policy", label: copy.footer.privacy }, { href: "/terms-of-use", label: copy.footer.terms }, { href: "/terms-of-sale", label: copy.footer.sales }];
  return <footer className="border-t border-mr-rule bg-mr-paper-warm"><div className="mx-auto max-w-[80rem] px-5 py-14 sm:px-8 sm:py-20"><div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]"><div><Wordmark locale={locale} /><p className="mr-small mt-6 max-w-[22rem] text-mr-graphite">{copy.footer.summary}</p></div><nav aria-label="Fine Bindery"><p className="mr-eyebrow text-mr-graphite">Fine Bindery</p><ul className="mr-small mt-5 space-y-3">{nav.map((item) => <li key={item.href}><a href={item.href} className="mr-tap text-mr-graphite underline-offset-4 hover:text-mr-ink hover:underline">{item.label}</a></li>)}</ul></nav><div><p className="mr-eyebrow text-mr-graphite">{copy.footer.information}</p><ul className="mr-small mt-5 space-y-3">{legal.map((item) => <li key={item.href}><a href={item.href} className="mr-tap text-mr-graphite underline-offset-4 hover:text-mr-ink hover:underline">{item.label}</a></li>)}</ul></div></div><p className="mr-small mt-12 border-t border-mr-rule pt-8 text-mr-graphite">{BRAND.displayName} — {copy.footer.closing}</p></div></footer>;
}
