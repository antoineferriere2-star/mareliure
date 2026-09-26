import { MARKETPLACE_BRAND_CONFIGS } from "@/marketplace/brand/brandConfig";
import { FineBinderyLanguageSwitch } from "@/marketplace/i18n/FineBinderyLanguageSwitch";
import { fineBinderyCopy } from "@/marketplace/i18n/fineBinderyCopy";
import { fineBinderyDirectoryPath, fineBinderyHomePath, fineBinderyProjectPath, type FineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";
import { actionClass } from "@/marketplace/pages/landing/actions";

const BRAND = MARKETPLACE_BRAND_CONFIGS.FINE_BINDERY;

/** Même grammaire de boutons que Ma Reliure : primaire sombre, secondaire filet. */
export function FineBinderyIntakeCta({ locale, slug, variant = "solid", size = "default", onInk = false, label }: { locale: FineBinderyLocale; slug?: string; variant?: "solid" | "outline"; size?: "default" | "compact"; onInk?: boolean; label?: string }) {
  const copy = fineBinderyCopy(locale);
  return <a href={fineBinderyProjectPath(locale, slug)} className={actionClass(variant === "solid" ? "primary" : "secondary", size, onInk)}>{label ?? copy.common.start}</a>;
}

function Wordmark({ locale }: { locale: FineBinderyLocale }) {
  return <a href={fineBinderyHomePath(locale)} className="inline-flex shrink-0 flex-col leading-none" aria-label={`${BRAND.displayName} — ${fineBinderyCopy(locale).trust.home}`}><span className="mr-title text-[1.35rem] text-mr-ink sm:text-[1.5rem]">{BRAND.displayName}</span><span aria-hidden="true" className="mt-1.5 h-px w-8 bg-mr-bordeaux" /></a>;
}

function navigation(locale: FineBinderyLocale) {
  const copy = fineBinderyCopy(locale); const home = fineBinderyHomePath(locale);
  return [{ href: fineBinderyDirectoryPath(locale), label: copy.nav.workshops }, { href: `${home}#offers`, label: copy.nav.services }, { href: `${home}#how-it-works`, label: copy.nav.how }, { href: `${home}#faq`, label: copy.nav.faq }, { href: `/auth?space=atelier&locale=${locale}`, label: copy.trust.atelier }];
}

export function FineBinderyHeader({ locale }: { locale: FineBinderyLocale }) {
  const copy = fineBinderyCopy(locale); const nav = navigation(locale);
  const link = "mr-tap mr-small text-mr-graphite underline-offset-[6px] hover:text-mr-ink hover:underline";
  return <header className="sticky top-0 z-40 border-b border-mr-rule/70 bg-mr-paper/95 backdrop-blur">
    <div className="mx-auto flex max-w-[80rem] items-center justify-between gap-5 px-5 py-3 sm:px-8 lg:py-4">
      <Wordmark locale={locale} />
      <nav aria-label="Fine Bindery" className="hidden xl:block"><ul className="flex items-center gap-4 xl:gap-5">{nav.map((item) => <li key={item.href}><a href={item.href} className={link}>{item.label}</a></li>)}</ul></nav>
      <div className="hidden shrink-0 items-center gap-4 xl:flex"><FineBinderyLanguageSwitch locale={locale} label={copy.nav.language} /><a href={`/auth?locale=${locale}`} className={`${link} shrink-0`}>{copy.nav.signIn}</a><span className="hidden 2xl:inline-flex"><FineBinderyIntakeCta locale={locale} variant="outline" size="compact" /></span></div>
      {/* Mobile : un seul menu, sans JavaScript — <details> reste accessible au clavier. */}
      <details className="group relative xl:hidden">
        <summary className="mr-tap mr-small flex min-h-11 cursor-pointer list-none items-center gap-2 border border-mr-rule-strong px-4 font-semibold text-mr-ink [&::-webkit-details-marker]:hidden">{copy.nav.menu}<span aria-hidden="true" className="text-[0.7rem] transition-transform group-open:rotate-180">▾</span></summary>
        <div className="absolute right-0 top-[calc(100%+0.75rem)] w-[min(20rem,calc(100vw-2.5rem))] border border-mr-rule bg-mr-paper p-5 shadow-[0_18px_40px_-24px_rgba(20,18,14,0.45)]">
          <nav aria-label="Fine Bindery"><ul className="divide-y divide-mr-rule">{nav.map((item) => <li key={item.href}><a href={item.href} className="flex min-h-12 items-center text-[1rem] text-mr-ink hover:underline">{item.label}</a></li>)}<li><a href={`/auth?locale=${locale}`} className="flex min-h-12 items-center text-[1rem] text-mr-graphite hover:underline">{copy.nav.signIn}</a></li></ul></nav>
          <div className="mt-4 border-t border-mr-rule pt-4"><p className="mr-eyebrow mb-2">{copy.nav.language}</p><FineBinderyLanguageSwitch locale={locale} label={copy.nav.language} /></div>
          <div className="mt-5"><FineBinderyIntakeCta locale={locale} /></div>
        </div>
      </details>
    </div>
  </header>;
}

export function FineBinderyFooter({ locale }: { locale: FineBinderyLocale }) {
  const copy = fineBinderyCopy(locale); const nav = navigation(locale);
  const legal = [{ href: "/legal-notice", label: copy.footer.legal }, { href: "/privacy-policy", label: copy.footer.privacy }, { href: "/terms-of-use", label: copy.footer.terms }, { href: "/terms-of-sale", label: copy.footer.sales }];
  return <footer className="border-t border-mr-rule bg-mr-paper-warm"><div className="mx-auto max-w-[80rem] px-5 py-14 sm:px-8 sm:py-20"><div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]"><div><Wordmark locale={locale} /><p className="mr-small mt-6 max-w-[22rem] text-mr-graphite">{copy.footer.summary}</p><p className="mr-small mt-4 max-w-[26rem]">{copy.trust.brands} <a className="mr-link" href="https://mareliure.fr/">Ma Reliure</a></p><p className="mr-small mt-4 max-w-[26rem]">{copy.trust.atelierAccess}</p><div className="mt-6"><FineBinderyLanguageSwitch locale={locale} label={`${copy.nav.language} · ${BRAND.displayName}`} /></div></div><nav aria-label={`${copy.nav.menu} · ${BRAND.displayName}`}><p className="mr-eyebrow text-mr-graphite">Fine Bindery</p><ul className="mr-small mt-5 space-y-3">{nav.map((item) => <li key={item.href}><a href={item.href} className="mr-tap text-mr-graphite underline-offset-4 hover:text-mr-ink hover:underline">{item.label}</a></li>)}</ul></nav><div><p className="mr-eyebrow text-mr-graphite">{copy.footer.information}</p><p className="mr-small mt-3">{copy.trust.legalLanguage}</p><ul className="mr-small mt-5 space-y-3">{legal.map((item) => <li key={item.href}><a href={item.href} className="mr-tap text-mr-graphite underline-offset-4 hover:text-mr-ink hover:underline">{item.label}</a></li>)}</ul></div></div><p className="mr-small mt-12 border-t border-mr-rule pt-8 text-mr-graphite">{BRAND.displayName} — {copy.footer.closing}</p></div></footer>;
}
