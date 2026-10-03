import { SectionHead, SectionRule, SHELL } from "@/marketplace/pages/landing/LandingChrome";
import { Plate } from "@/marketplace/pages/landing/Plate";
import { ActionLink } from "@/marketplace/pages/landing/actions";
import { PHOTOS } from "@/marketplace/pages/landing/photos";
import { usePageViewTracking } from "@/build/pages/public/usePageViewTracking";
import { FineBinderyFooter, FineBinderyHeader, FineBinderyIntakeCta } from "./FineBinderyChrome";
import { FEATURED_WORKSHOP } from "./content";
import { fineBinderyCopy } from "@/marketplace/i18n/fineBinderyCopy";
import { ENGINE_LOCALE, fineBinderyDirectoryPath, type FineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";
import { specialtyName } from "@/marketplace/i18n/fineBinderyGlossary";
import { useFineBinderyDocumentLocale } from "@/marketplace/i18n/FineBinderyLanguageSwitch";
import {
  FERRIERE_FINE_BINDERY_OFFER_KEYS,
  FERRIERE_SERVICE_PHOTO_CREDIT,
  FERRIERE_SERVICE_PHOTO_SOURCE,
  ferriereServicePhoto,
} from "@/marketplace/pages/pricing/ferriereServiceIllustrations";

type Copy = ReturnType<typeof fineBinderyCopy>;

const ROMAN = ["I", "II", "III", "IV", "V", "VI"] as const;

/** « Planche », abrégé comme dans un catalogue de chaque langue. */
const PLATE_LABEL: Record<FineBinderyLocale, string> = { en: "Pl.", fr: "Pl.", de: "Taf.", it: "Tav.", es: "Lám." };

/** Description de la pièce du premier écran, dans la langue de la page. */
const HERO_ALT: Record<FineBinderyLocale, string> = {
  en: "A contemporary design binding in grey and aubergine leather mosaic, titled in gold and silver, on Baudelaire’s Le Spleen de Paris",
  fr: "Une reliure de création en mosaïque de cuir gris et aubergine, titrée à l’or et à l’argent, sur Le Spleen de Paris de Baudelaire",
  de: "Ein zeitgenössischer Künstlereinband aus grauem und auberginefarbenem Ledermosaik, in Gold und Silber betitelt, auf Baudelaires Le Spleen de Paris",
  it: "Una legatura d’arte contemporanea in mosaico di pelle grigia e melanzana, titolata in oro e argento, su Le Spleen de Paris di Baudelaire",
  es: "Una encuadernación artística contemporánea en mosaico de piel gris y berenjena, titulada en oro y plata, sobre Le Spleen de Paris de Baudelaire",
};

/**
 * L'accueil Fine Bindery — registre « cabinet » (docs/design/premium-art-direction.md).
 *
 * Le premier écran est un cabinet sombre : le titre, et en regard une seule
 * pièce — Le Spleen de Paris, reliure de création de l'atelier Ferrière,
 * créditée (usage Fine Bindery autorisé le 2 octobre 2026). La notice du
 * réseau suit en bas de l'écran, comme la fiche sous une vitrine. Rien
 * d'inventé : un seul atelier réel, et le réseau dit qu'il ouvre en France.
 *
 * Tant que l'annuaire ne publie aucun atelier, l'action principale est de
 * présenter son projet ; parcourir l'annuaire reste l'alternative.
 */
export function FineBinderyLandingPage({ locale = "en" }: { locale?: FineBinderyLocale }) {
  const copy = fineBinderyCopy(locale); useFineBinderyDocumentLocale(locale); usePageViewTracking(ENGINE_LOCALE[locale]);
  return <div className="mr-site fb-site flex min-h-screen flex-col bg-mr-paper text-mr-graphite"><FineBinderyHeader locale={locale} /><main id="top">
    <Hero copy={copy} locale={locale} />
    <Disciplines copy={copy} locale={locale} />
    <Paths copy={copy} locale={locale} />
    <HowItWorks copy={copy} />
    <Workshops copy={copy} locale={locale} />
    <Trust copy={copy} />
    <ShippingFaq copy={copy} />
    <FinalCta copy={copy} locale={locale} />
  </main><FineBinderyFooter locale={locale} /></div>;
}

/** Le cabinet : titre en grand sur brun, une pièce en regard, puis la notice du réseau. */
function Hero({ copy, locale }: { copy: Copy; locale: FineBinderyLocale }) {
  const facts = copy.home.proof.split(" · ");
  return <section className="bg-mr-umber text-mr-paper"><div className={`${SHELL} pt-14 pb-14 sm:pt-20 sm:pb-20 lg:pt-24 lg:pb-24`}>
    <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-16">
      <div className="lg:col-span-7">
        <p className="mr-eyebrow text-mr-paper/80 [text-wrap:balance]">{copy.home.eyebrow}</p>
        <h1 className="mr-display mt-7 text-mr-paper">{copy.home.title}</h1>
        <p className="mr-lead mt-8 max-w-[36rem] text-mr-paper/85">{copy.home.lead}</p>
        <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
          <FineBinderyIntakeCta locale={locale} onInk />
          <ActionLink href={fineBinderyDirectoryPath(locale)} variant="secondary" onInk>{copy.home.discover}</ActionLink>
        </div>
      </div>
      <Plate className="lg:col-span-5" photo={PHOTOS.ferriereBaudelaire} sizes="(min-width: 1024px) 480px, 100vw" priority mat="ink" number={1} numberLabel={PLATE_LABEL[locale]}
        alt={HERO_ALT[locale]}
        caption="Le Spleen de Paris" credit={FERRIERE_SERVICE_PHOTO_CREDIT} />
    </div>
    <ul className="mt-14 grid sm:grid-cols-3 sm:gap-8 lg:mt-20">
      <li aria-hidden="true" className="sm:col-span-3"><span className="mr-filet text-mr-paper" /></li>
      {facts.map((fact, index) => <li key={fact} className="flex items-baseline gap-4 border-b border-mr-paper/20 py-4 sm:border-b-0"><span aria-hidden="true" className="mr-folio w-6 shrink-0 text-mr-paper/70">{ROMAN[index]}</span><span className="mr-small text-mr-paper/90">{fact}</span></li>)}
    </ul>
  </div></section>;
}

function Disciplines({ copy, locale }: { copy: Copy; locale: FineBinderyLocale }) {
  return <section id="offers" className="scroll-mt-32"><div className={`${SHELL} py-section-sm sm:py-section`}>
    <SectionHead folio="I" eyebrow={copy.home.offersEyebrow} title={copy.home.offersTitle} />
    <ul className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4">{copy.home.offers.map((item, index) => {
      const photo = ferriereServicePhoto(FERRIERE_FINE_BINDERY_OFFER_KEYS[index]);
      return <li key={item.title}><Plate photo={photo} sizes="(min-width: 1024px) 300px, (min-width: 640px) 50vw, 100vw" ratio="landscape" alt="" number={index + 2} numberLabel={PLATE_LABEL[locale]} caption={item.title} /><p className="mr-body mt-3">{item.body}</p></li>;
    })}</ul>
    <p className="mr-meta mt-10">{copy.home.photoCredit} · <a className="mr-link" href={FERRIERE_SERVICE_PHOTO_SOURCE}>{FERRIERE_SERVICE_PHOTO_CREDIT}</a></p>
  </div></section>;
}

function Paths({ copy, locale }: { copy: Copy; locale: FineBinderyLocale }) {
  const [browse, present] = copy.home.paths;
  return <section className="bg-mr-paper-warm"><div className={`${SHELL} py-section-sm sm:py-section`}>
    <SectionHead folio="II" eyebrow={copy.home.pathsEyebrow} title={copy.home.pathsTitle} />
    <div className="mt-12 grid gap-px border border-mr-rule bg-mr-rule md:grid-cols-2">
      {[present, browse].map((path, index) => <article key={path.title} className="flex flex-col bg-mr-paper p-7 sm:p-10">
        <span className="mr-folio text-mr-bordeaux">{ROMAN[index]}</span>
        <h3 className="mr-title mt-4 text-[1.75rem] text-mr-ink sm:text-[2rem]">{path.title}</h3>
        <p className="mr-body mt-4 max-w-[32rem] flex-1">{path.body}</p>
        <div className="mt-8">{index === 0 ? <FineBinderyIntakeCta locale={locale} label={path.cta} /> : <ActionLink href={fineBinderyDirectoryPath(locale)} variant="secondary">{path.cta}</ActionLink>}</div>
      </article>)}
    </div>
  </div></section>;
}

/** Six étapes, lues comme un itinéraire : un numéro en serif, une ligne, la suivante. */
function HowItWorks({ copy }: { copy: Copy }) {
  return <section id="how-it-works" className="scroll-mt-32"><div className={`${SHELL} py-section-sm sm:py-section`}>
    <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
      <div className="lg:col-span-5"><SectionHead folio="III" eyebrow={copy.home.howEyebrow} title={copy.home.howTitle} /></div>
      <ol className="lg:col-span-7 lg:pt-14">{copy.home.steps.map((title, index) => <li key={title} className="flex items-baseline gap-6 border-b border-mr-rule py-5 first:border-t"><span className="mr-display w-10 shrink-0 text-[2.25rem] leading-none text-mr-bordeaux">{index + 1}</span><p className="mr-heading text-[1.125rem] text-mr-ink">{title}</p></li>)}</ol>
    </div>
  </div></section>;
}

/**
 * L'atelier mis en avant, crédité sous sa planche (usage Fine Bindery
 * autorisé le 2 octobre 2026, docs/content-assets.md). La mention « publié
 * par Fine Bindery » a été retirée : l'annuaire ne publie encore aucune page
 * d'atelier.
 */
function Workshops({ copy, locale }: { copy: Copy; locale: FineBinderyLocale }) {
  const w = FEATURED_WORKSHOP;
  return <section id="workshops" className="scroll-mt-32 bg-mr-paper-warm"><div className={`${SHELL} py-section-sm sm:py-section`}>
    <SectionHead folio="IV" eyebrow={copy.home.workshopsEyebrow} title={copy.home.workshopsTitle} lead={copy.home.workshopsLead} />
    <div className="mt-12 grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
      <div className="lg:col-span-7">{w.image ? <Plate photo={w.image} sizes="(min-width: 1024px) 640px, 100vw" alt={w.imageAlt ?? w.name} caption={w.name} credit={`${w.city}, ${copy.common.france}`} /> : null}</div>
      <div className="lg:col-span-5">
        <p className="mr-eyebrow text-mr-bordeaux">{w.city}, {copy.common.france}</p>
        <h3 className="mr-title mt-3 text-mr-ink">{w.name}</h3>
        <p className="mr-small mt-2">{w.artisan}{w.since ? ` — ${copy.home.established} ${w.since}` : ""}</p>
        <p className="mr-body mt-6">{w.specialties.map((value) => specialtyName(value.toLowerCase().replaceAll(" ", "_"), locale)).join(" · ")}</p>
        <a href={fineBinderyDirectoryPath(locale)} className="mr-link mr-tap mt-7 text-[1.0625rem]">{copy.home.discoverWorkshops}</a>
      </div>
    </div>
    <p className="mr-body mt-14 max-w-[46rem] border-l-2 border-mr-bordeaux pl-5 text-mr-ink">{copy.home.networkNote}</p>
  </div></section>;
}

/** Quatre garanties, en registre : un numéro, une ligne, sur le brun du cabinet. */
function Trust({ copy }: { copy: Copy }) {
  return <section className="bg-mr-umber text-mr-paper"><div className={`${SHELL} py-section sm:py-section-lg`}>
    <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
      <div className="lg:col-span-5"><SectionHead folio="V" eyebrow={copy.home.trustEyebrow} title={copy.home.trustTitle} tone="paper" /></div>
      <ol className="lg:col-span-7 lg:pt-14">{copy.home.trust.map((title, index) => <li key={title} className="flex items-baseline gap-6 border-b border-mr-paper/20 py-5 first:border-t"><span className="mr-folio w-8 shrink-0 text-mr-paper/70">{ROMAN[index]}</span><p className="font-editorial text-[1.5rem] leading-snug text-mr-paper">{title}</p></li>)}</ol>
    </div>
  </div></section>;
}

function ShippingFaq({ copy }: { copy: Copy }) {
  return <section id="faq" className="scroll-mt-32"><div className={`${SHELL} py-section-sm sm:py-section`}>
    <SectionRule folio="VI" />
    <div className="mt-8 grid gap-12 lg:grid-cols-12 lg:gap-16">
      <div className="lg:col-span-5"><SectionHead eyebrow={copy.home.faqEyebrow} title={copy.home.faqTitle} /><div className="mt-10 border-t border-mr-rule-strong pt-6"><p className="mr-eyebrow">{copy.home.shippingEyebrow}</p><h3 className="mr-heading mt-3 text-mr-ink">{copy.home.shippingTitle}</h3><p className="mr-body mt-2">{copy.home.shippingLead}</p></div></div>
      <div className="divide-y divide-mr-rule-strong border-y border-mr-rule-strong lg:col-span-7">{copy.home.faq.map((item) => <details key={item.question} className="group py-5"><summary className="mr-body flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold text-mr-ink [&::-webkit-details-marker]:hidden">{item.question}<span aria-hidden="true" className="text-mr-bordeaux transition-transform group-open:rotate-45">+</span></summary><p className="mr-body mt-3 max-w-[38rem]">{item.answer}</p></details>)}</div>
    </div>
  </div></section>;
}

function FinalCta({ copy, locale }: { copy: Copy; locale: FineBinderyLocale }) {
  return <section className="border-t border-mr-rule bg-mr-paper-warm"><div className={`${SHELL} py-section-sm text-center sm:py-section`}>
    <h2 className="mr-title mx-auto max-w-[34rem] text-mr-ink">{copy.home.finalTitle}</h2>
    <p className="mr-lead mx-auto mt-5 max-w-[36rem]">{copy.home.finalLead}</p>
    <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4"><FineBinderyIntakeCta locale={locale} /><ActionLink href={fineBinderyDirectoryPath(locale)} variant="secondary">{copy.home.discover}</ActionLink></div>
    <span aria-hidden="true" className="mr-filet mx-auto mt-14 w-16 text-mr-bordeaux" />
  </div></section>;
}
