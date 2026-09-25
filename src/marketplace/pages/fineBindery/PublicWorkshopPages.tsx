import { useMemo, useState, type ReactNode } from "react";
import { PUBLIC_LANGUAGES, PUBLIC_MATERIALS, PUBLIC_TECHNIQUES } from "@/marketplace/binders/fineBinderyProfile";
import { FineBinderyFooter, FineBinderyHeader, FineBinderyIntakeCta } from "./FineBinderyChrome";
import { fineBinderyCopy } from "@/marketplace/i18n/fineBinderyCopy";
import { countryName, languageName, specialtyName, techniqueName } from "@/marketplace/i18n/fineBinderyGlossary";
import { fineBinderyDirectoryPath, fineBinderyProfilePath, type FineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";
import { useFineBinderyDocumentLocale } from "@/marketplace/i18n/FineBinderyLanguageSwitch";
import { SHELL } from "@/marketplace/pages/landing/LandingChrome";

type DirectoryProfile = { slug: string; path: string; workshopName: string; professionalName: string; city: string; countryCode: string; bio: string; languages: string[]; skills: { slug: string; label: string; labelEn: string }[]; imageUrl: string | null };
type PublicProfile = Awaited<ReturnType<typeof import("@/marketplace/services/fineBinderyProfile.data.functions").getPublicFineBinderyProfile>>;

function FineBinderyPage({ locale, children }: { locale: FineBinderyLocale; children: ReactNode }) {
  return <div className="mr-site fb-site flex min-h-screen flex-col bg-mr-paper text-mr-graphite"><FineBinderyHeader locale={locale} /><main className="flex-1">{children}</main><FineBinderyFooter locale={locale} /></div>;
}

/** Monogramme quand l'atelier n'a pas encore de photographie : jamais d'image inventée. */
function Monogram({ name, large = false }: { name: string; large?: boolean }) {
  return <div aria-hidden="true" className={`flex aspect-[4/3] w-full items-center justify-center bg-mr-paper-deep font-editorial text-mr-bordeaux ${large ? "text-[5rem]" : "text-[3.25rem]"}`}>{name.slice(0, 1)}</div>;
}

export function FineBinderyDirectoryPage({ profiles, locale }: { profiles: DirectoryProfile[]; locale: FineBinderyLocale }) {
  const copy = fineBinderyCopy(locale); useFineBinderyDocumentLocale(locale);
  const [country, setCountry] = useState(""); const [specialty, setSpecialty] = useState(""); const [language, setLanguage] = useState("");
  const filtered = useMemo(() => profiles.filter((p) => (!country || p.countryCode === country) && (!specialty || p.skills.some((s) => s.slug === specialty)) && (!language || p.languages.includes(language))), [profiles, country, specialty, language]);
  const specialties = useMemo(() => [...new Set(profiles.flatMap((p) => p.skills.map((s) => s.slug)))].sort((a, b) => specialtyName(a, locale).localeCompare(specialtyName(b, locale), locale)), [profiles, locale]);
  const countries = useMemo(() => [...new Set(profiles.map((p) => p.countryCode))].sort(), [profiles]);
  const filtering = Boolean(country || specialty || language);
  const reset = () => { setCountry(""); setSpecialty(""); setLanguage(""); };
  return <FineBinderyPage locale={locale}>
    <section className={`${SHELL} pt-14 pb-12 sm:pt-20 sm:pb-16`}><p className="mr-eyebrow text-mr-bordeaux">{copy.directory.eyebrow}</p><h1 className="mr-display mt-6 text-mr-ink">{copy.directory.title}</h1><p className="mr-lead mt-7 max-w-[40rem]">{copy.directory.lead}</p></section>
    {profiles.length === 0 ? <DirectoryOpening copy={copy} locale={locale} /> : <>
      <section aria-label={copy.directory.filters} className="border-y border-mr-rule bg-mr-paper-warm"><div className={`${SHELL} grid items-end gap-2.5 py-4 sm:grid-cols-2 sm:gap-4 sm:py-5 lg:grid-cols-[1fr_1fr_1fr_auto] lg:gap-6`}>
        <Filter label={copy.directory.country} value={country} onChange={setCountry}><option value="">{copy.directory.allCountries}</option>{countries.map((code) => <option key={code} value={code}>{countryName(code, locale)}</option>)}</Filter>
        <Filter label={copy.directory.specialty} value={specialty} onChange={setSpecialty}><option value="">{copy.directory.allSpecialties}</option>{specialties.map((key) => <option key={key} value={key}>{specialtyName(key, locale)}</option>)}</Filter>
        <Filter label={copy.directory.language} value={language} onChange={setLanguage}><option value="">{copy.directory.allLanguages}</option>{PUBLIC_LANGUAGES.map((item) => <option key={item.code} value={item.code}>{languageName(item.code, locale)}</option>)}</Filter>
        <div className="flex min-h-11 items-center justify-between gap-5 pt-1 sm:col-span-2 sm:pt-0 lg:col-span-1 lg:justify-end"><p className="mr-small whitespace-nowrap text-mr-ink" aria-live="polite">{copy.directory.count(filtered.length)}</p>{filtering && <button type="button" onClick={reset} className="mr-link mr-tap mr-small whitespace-nowrap">{copy.directory.reset}</button>}</div>
      </div></section>
      <section className={`${SHELL} py-section-sm sm:py-section`}>{filtered.length === 0
        ? <div className="border-y border-mr-rule py-12 text-center"><p className="mr-body text-mr-ink">{copy.directory.empty}</p><button type="button" onClick={reset} className="mr-link mr-tap mt-4 text-[1.0625rem]">{copy.directory.reset}</button></div>
        : <ul className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((p) => <li key={p.slug}><WorkshopCard profile={p} locale={locale} /></li>)}</ul>}
      </section>
      <div className={`${SHELL} pb-section-sm`}><p className="mr-small border-l-2 border-mr-bordeaux pl-4 text-mr-graphite">{copy.directory.openingNote}</p></div>
    </>}
  </FineBinderyPage>;
}

function WorkshopCard({ profile: p, locale }: { profile: DirectoryProfile; locale: FineBinderyLocale }) {
  const copy = fineBinderyCopy(locale);
  const colon = locale === "fr" ? " : " : ": ";
  return <a href={fineBinderyProfilePath(locale, p.slug)} className="group block">
    <div className="overflow-hidden bg-mr-paper-deep">{p.imageUrl ? <img src={p.imageUrl} alt="" width={800} height={600} loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" /> : <Monogram name={p.workshopName} />}</div>
    <p className="mr-eyebrow mt-5 text-mr-bordeaux">{p.city}, {countryName(p.countryCode, locale)}</p>
    <h2 className="mr-title mt-2 text-[1.625rem] text-mr-ink group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{p.workshopName}</h2>
    {p.skills.length > 0 && <p className="mr-body mt-3">{p.skills.slice(0, 4).map((s) => specialtyName(s.slug, locale)).join(" · ")}</p>}
    {p.languages.length > 0 && <p className="mr-small mt-2 text-mr-muted">{copy.profile.languages}{colon}{p.languages.map((code) => languageName(code, locale)).join(", ")}</p>}
    <span className="mr-small mt-5 inline-flex min-h-11 items-center gap-2 font-semibold text-mr-ink">{copy.directory.view}<span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span></span>
  </a>;
}

function DirectoryOpening({ copy, locale }: { copy: ReturnType<typeof fineBinderyCopy>; locale: FineBinderyLocale }) {
  return <section className="border-t border-mr-rule bg-mr-paper-warm"><div className={`${SHELL} py-section-sm sm:py-section`}><div className="max-w-[40rem]">
    <h2 className="mr-title text-mr-ink">{copy.directory.emptyTitle}</h2>
    <p className="mr-body mt-5">{copy.directory.emptyBody}</p>
    <div className="mt-8"><FineBinderyIntakeCta locale={locale} /></div>
    <p className="mr-small mt-10 border-l-2 border-mr-bordeaux pl-4 text-mr-graphite">{copy.directory.openingNote}</p>
  </div></div></section>;
}

function Filter({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <label className="mr-eyebrow block text-mr-graphite"><span className="max-sm:sr-only">{label}</span><select className="block sm:mt-2 min-h-11 w-full rounded-[2px] border border-mr-rule-strong bg-mr-paper px-3 text-[0.9375rem] font-normal normal-case tracking-normal text-mr-ink" value={value} onChange={(event) => onChange(event.target.value)}>{children}</select></label>;
}

export function FineBinderyWorkshopPage({ profile, locale }: { profile: NonNullable<PublicProfile>; locale: FineBinderyLocale }) {
  const copy = fineBinderyCopy(locale); useFineBinderyDocumentLocale(locale);
  const techniques = profile.techniqueKeys.map((key) => techniqueName(key, locale)); const materials = profile.materialKeys.map((key) => techniqueName(key, locale));
  const place = `${profile.city}, ${countryName(profile.countryCode, locale)}`;
  const contacts = [
    profile.websiteUrl ? { href: profile.websiteUrl, label: copy.profile.website, external: true } : null,
    profile.instagramUrl ? { href: profile.instagramUrl, label: "Instagram", external: true } : null,
    profile.professionalPhone ? { href: `tel:${profile.professionalPhone}`, label: copy.profile.call, external: false } : null,
    profile.professionalEmail ? { href: `mailto:${profile.professionalEmail}`, label: copy.profile.email, external: false } : null,
  ].filter((item) => item !== null);
  return <FineBinderyPage locale={locale}>
    <section className={`${SHELL} grid gap-10 pt-10 pb-section-sm sm:pt-14 lg:grid-cols-12 lg:items-center lg:gap-14`}>
      <div className="lg:col-span-6">
        <a href={fineBinderyDirectoryPath(locale)} className="mr-small mr-tap text-mr-muted underline-offset-4 hover:text-mr-ink hover:underline"><span aria-hidden="true">← </span>{copy.profile.back}</a>
        <p className="mr-eyebrow mt-8 text-mr-bordeaux">{copy.profile.workshop} · {place}</p>
        <h1 className="mr-display mt-5 text-mr-ink">{profile.workshopName}</h1>
        {profile.professionalName && <p className="mr-lead mt-5">{profile.professionalName}</p>}
        {profile.skills.length > 0 && <ul aria-label={copy.profile.specialties} className="mt-7 flex flex-wrap gap-2">{profile.skills.map((s) => <li key={s.slug} className="mr-small border border-mr-rule-strong px-3 py-1.5 text-mr-ink">{specialtyName(s.slug, locale)}</li>)}</ul>}
        <div className="mt-9"><FineBinderyIntakeCta locale={locale} slug={profile.slug} label={copy.profile.discuss} /></div>
      </div>
      <div className="lg:col-span-6">{profile.workshopPhotoUrl ? <img src={profile.workshopPhotoUrl} alt={profile.workshopName} width={1200} height={900} fetchPriority="high" className="aspect-[4/3] w-full bg-mr-paper-deep object-cover" /> : <Monogram name={profile.workshopName} large />}</div>
    </section>

    <section className="border-t border-mr-rule"><div className={`${SHELL} grid gap-8 py-section-sm sm:py-section lg:grid-cols-12 lg:gap-14`}>
      <div className="lg:col-span-4"><h2 className="mr-eyebrow">{copy.profile.about}</h2></div>
      <div className="lg:col-span-8"><p className="mr-lead whitespace-pre-line text-mr-ink">{profile.bio}</p>{locale !== "fr" && <p className="mr-meta mt-4 italic">{copy.common.originalText}</p>}
        {(profile.training || profile.philosophy) && <div className="mt-12 grid gap-10 sm:grid-cols-2">{profile.training && <Info title={copy.profile.training}>{profile.training}</Info>}{profile.philosophy && <Info title={copy.profile.approach}>{profile.philosophy}</Info>}</div>}
      </div>
    </div></section>

    {profile.portfolio.length > 0 && <section className="bg-mr-paper-warm"><div className={`${SHELL} py-section-sm sm:py-section`}>
      <p className="mr-eyebrow">{copy.profile.portfolio}</p><h2 className="mr-title mt-4 text-mr-ink">{copy.profile.work}</h2>
      <div className="mt-12 grid gap-x-10 gap-y-14 md:grid-cols-2">{profile.portfolio.map((item) => <article key={item.id}>
        <div className={`grid gap-2 ${item.beforePhotoUrl && item.afterPhotoUrl ? "grid-cols-2" : "grid-cols-1"}`}>
          {item.beforePhotoUrl && <figure><img src={item.beforePhotoUrl} alt={`${item.title} — ${copy.profile.before}`} width={800} height={600} loading="lazy" decoding="async" className="aspect-[4/3] w-full bg-mr-paper-deep object-cover" /><figcaption className="mr-meta mt-2">{copy.profile.before}</figcaption></figure>}
          {item.afterPhotoUrl && <figure><img src={item.afterPhotoUrl} alt={item.beforePhotoUrl ? `${item.title} — ${copy.profile.after}` : item.title} width={800} height={600} loading="lazy" decoding="async" className="aspect-[4/3] w-full bg-mr-paper-deep object-cover" />{item.beforePhotoUrl && <figcaption className="mr-meta mt-2">{copy.profile.after}</figcaption>}</figure>}
        </div>
        <h3 className="mr-heading mt-5 text-mr-ink">{item.title}{item.year ? ` · ${item.year}` : ""}</h3>
        {item.description && <p className="mr-body mt-2">{item.description}</p>}
      </article>)}</div>
    </div></section>}

    <section className={profile.portfolio.length > 0 ? "" : "border-t border-mr-rule"}><div className={`${SHELL} grid gap-10 py-section-sm sm:grid-cols-3 sm:py-section`}>
      <Info title={copy.profile.techniques}>{[...techniques, ...materials].join(" · ") || copy.profile.according}</Info>
      <Info title={copy.profile.languages}>{profile.languages.map((code) => languageName(code, locale)).join(" · ")}</Info>
      <Info title={copy.profile.location}>{place}</Info>
    </div></section>

    <section className="bg-mr-umber text-mr-paper"><div className={`${SHELL} py-section-sm text-center sm:py-section`}>
      <p className="mr-eyebrow">{copy.profile.finalEyebrow}</p>
      <h2 className="mr-title mx-auto mt-4 max-w-[36rem]">{copy.profile.finalTitle(profile.workshopName)}</h2>
      <div className="mt-9"><FineBinderyIntakeCta locale={locale} slug={profile.slug} label={copy.profile.discuss} onInk /></div>
      {contacts.length > 0 && <ul className="mt-9 flex flex-wrap justify-center gap-x-7 gap-y-2">{contacts.map((item) => <li key={item.href}><a href={item.href} rel={item.external ? "noreferrer" : undefined} className="mr-tap mr-small text-mr-paper/85 underline underline-offset-4 hover:text-mr-paper">{item.label}</a></li>)}</ul>}
    </div></section>
  </FineBinderyPage>;
}

function Info({ title, children }: { title: string; children: ReactNode }) {
  return <div className="border-t border-mr-rule-strong pt-5"><h2 className="mr-eyebrow">{title}</h2><p className="mr-body mt-3 whitespace-pre-line text-mr-ink">{children}</p></div>;
}

export function FineBinderyWorkshopNotFound({ locale }: { locale: FineBinderyLocale }) {
  const copy = fineBinderyCopy(locale); useFineBinderyDocumentLocale(locale);
  return <FineBinderyPage locale={locale}><div className={`${SHELL} py-section text-center`}><h1 className="mr-title text-mr-ink">{copy.profile.notFound}</h1><p className="mr-body mt-4">{copy.profile.notFoundBody}</p><a href={fineBinderyDirectoryPath(locale)} className="mr-link mr-tap mt-8 text-[1.0625rem]">{copy.profile.back}</a></div></FineBinderyPage>;
}

export const FINE_BINDERY_PUBLIC_REFERENCE_COUNTS = { languages: PUBLIC_LANGUAGES.length, techniques: PUBLIC_TECHNIQUES.length, materials: PUBLIC_MATERIALS.length } as const;
