/**
 * `/partenaires-relieurs` — la page produit de l'espace atelier.
 *
 * Elle présentait surtout le réseau, en vingt et une sections. Elle montre
 * désormais d'abord l'outil, tel qu'il existe : devis, tarifs, ouvrages,
 * documents et factures, en captures réelles de l'application (données
 * d'exemple fictives, voir ProductShot). Le réseau vient ensuite, comme un
 * supplément, puis la gratuité, la FAQ et la candidature.
 *
 * Même discipline que la landing : aucun nombre d'ateliers, aucun témoignage,
 * aucun logo, parce qu'aucun n'est réel au lancement. Ce qui n'existe pas
 * encore (le paiement en ligne des factures de l'atelier) est écrit comme tel.
 */
import { useState, type FormEvent, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { IntakeCta, LandingFooter, LandingHeader, SectionHead, SHELL } from "@/marketplace/pages/landing/LandingChrome";
import { ActionLink, actionClass } from "@/marketplace/pages/landing/actions";
import { ProductShot, type ProductShotKey } from "@/marketplace/pages/landing/ProductShot";
import { usePageViewTracking } from "@/build/pages/public/usePageViewTracking";
import { submitBinderApplication } from "@/marketplace/services/binderApplications.data.functions";
import { BINDER_SKILLS } from "@/marketplace/binders/skills";
import {
  BENEFITS,
  DOCUMENT_POINTS,
  FREE_INCLUDES,
  HOW_IT_WORKS_STEPS,
  PARTNER_FAQ,
  PRICING_POINTS,
  QUOTE_POINTS,
  TOOL_OVERVIEW,
  WORK_POINTS,
} from "@/marketplace/pages/landing/partnersContent";

const CREATE_WORKSHOP = "/auth?space=atelier";

export function PartnersLandingPage() {
  usePageViewTracking();
  return (
    <div className="mr-site flex min-h-screen flex-col bg-mr-paper text-mr-graphite">
      <LandingHeader />
      <main>
        <Hero />
        <Overview />
        <Feature
          id="devis"
          eyebrow="Devis"
          title="Un devis prêt en quelques clics."
          lead="Ouvrez un devis, cochez ce que vous allez faire : vos prestations et vos prix sont déjà là, le total se construit sous vos yeux."
          points={QUOTE_POINTS}
          shot="devis"
          tone="warm"
        />
        <Feature
          id="tarifs"
          eyebrow="Prestations & tarifs"
          title="Vos tarifs, à votre main."
          lead="Vous ne partez pas d'une page blanche, et vous n'héritez pas d'une grille imposée : ajustez ce qui ne vous ressemble pas, ajoutez ce qui vous est propre."
          points={PRICING_POINTS}
          shot="tarifs"
          reverse
        />
        <Feature
          id="ouvrages"
          eyebrow="Ouvrages"
          title="L’ouvrage au centre."
          lead="Un livre, une fiche. Tout ce qui le concerne s'y rattache, du premier devis à la dernière facture."
          points={WORK_POINTS}
          shot="ouvrages"
          tone="warm"
        />
        <Documents />
        <Network />
        <Pricing />
        <Faq />
        <ApplicationForm />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className={`${SHELL} pt-14 pb-16 sm:pt-20 sm:pb-20 lg:pt-24 lg:pb-24`}>
      <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-5">
          <p className="mr-eyebrow">Pour les relieurs et restaurateurs</p>
          <h1 className="mr-display mt-6 text-mr-ink">
            Vos ouvrages, vos devis, vos clients. Dans un seul outil.
          </h1>
          <p className="mr-lead mt-7 max-w-[34rem]">
            L’espace atelier de Ma Reliure réunit ce qui encombre les soirées : devis, tarifs,
            fiches ouvrage et factures. Gratuit, et à votre nom.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <ActionLink href={CREATE_WORKSHOP}>Créer mon espace atelier</ActionLink>
            <ActionLink href="#outil" variant="secondary">
              Voir l’outil
            </ActionLink>
          </div>
          <p className="mr-small mt-8 max-w-[34rem]">
            0 € par mois <span aria-hidden="true">·</span> Vos clients restent les vôtres{" "}
            <span aria-hidden="true">·</span> Des projets Ma Reliure en plus
          </p>
        </div>
        <ProductShot shot="aujourdhui" priority className="lg:col-span-7" sizes="(min-width: 1024px) 720px, 100vw" />
      </div>
    </section>
  );
}

function Overview() {
  return (
    <section id="outil" className="scroll-mt-36 border-t border-mr-rule lg:scroll-mt-28">
      <div className={`${SHELL} py-12 sm:py-14`}>
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
          {TOOL_OVERVIEW.map((item) => (
            <li key={item.anchor}>
              <a href={`#${item.anchor}`} className="group block">
                <span className="mr-heading text-mr-ink underline-offset-[6px] group-hover:underline">{item.title}</span>
                <span className="mr-small mt-2 block">{item.body}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Une fonction de l'outil : le texte d'un côté, sa capture réelle de l'autre. */
function Feature({
  id,
  eyebrow,
  title,
  lead,
  points,
  shot,
  reverse = false,
  tone = "paper",
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead: string;
  points: readonly string[];
  shot: ProductShotKey;
  reverse?: boolean;
  tone?: "paper" | "warm";
}) {
  return (
    <section id={id} className={`scroll-mt-36 lg:scroll-mt-28 ${tone === "warm" ? "bg-mr-paper-warm" : ""}`}>
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <div className={`lg:col-span-5 ${reverse ? "lg:order-2" : ""}`}>
            <SectionHead eyebrow={eyebrow} title={title} lead={lead} />
            <Points items={points} />
          </div>
          <ProductShot shot={shot} className={`lg:col-span-7 ${reverse ? "lg:order-1" : ""}`} sizes="(min-width: 1024px) 700px, 100vw" />
        </div>
      </div>
    </section>
  );
}

function Points({ items, tone = "ink" }: { items: readonly string[]; tone?: "ink" | "paper" }) {
  return (
    <ul className="mt-8 space-y-3">
      {items.map((item) => (
        <li key={item} className="mr-body flex gap-3">
          <span aria-hidden="true" className={`mt-[0.8em] h-px w-4 shrink-0 ${tone === "paper" ? "bg-mr-paper/60" : "bg-mr-bordeaux"}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Documents() {
  return (
    <section id="factures" className="scroll-mt-36 lg:scroll-mt-28">
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <SectionHead
          eyebrow="Documents & factures"
          title="Des documents à votre nom, des factures en règle."
          lead="Le devis part au nom de votre atelier. Accepté, il devient une facture sans rien ressaisir ; la facture suit ensuite l'acompte, le paiement et, s'il le faut, l'avoir."
        />
        <div className="mt-12 grid items-start gap-10 lg:mt-16 lg:grid-cols-12 lg:gap-12">
          <ProductShot shot="pdf" className="lg:col-span-5" sizes="(min-width: 1024px) 480px, 100vw" caption="Devis PDF généré par l’outil — données d’exemple" />
          <div className="lg:col-span-7">
            <ProductShot shot="factures" sizes="(min-width: 1024px) 700px, 100vw" />
            <Points items={DOCUMENT_POINTS} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Network() {
  return (
    <section className="bg-mr-paper-warm">
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHead
              eyebrow="Le réseau Ma Reliure"
              title="Des projets Ma Reliure, en plus des vôtres."
              lead="Quand votre atelier est validé, Ma Reliure vous propose des livres qui correspondent à vos savoir-faire. Chaque proposition arrive complète, dans le même espace que vos propres clients."
            />
          </div>
          <ProductShot shot="projets" className="lg:col-span-7" sizes="(min-width: 1024px) 700px, 100vw" />
        </div>
        <div className="mt-14 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {BENEFITS.map((benefit) => (
            <div key={benefit.title} className="border-t border-mr-rule-strong pt-5">
              <h3 className="mr-heading text-mr-ink">{benefit.title}</h3>
              <p className="mr-body mt-2">{benefit.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-14 lg:mt-16">
          <h3 className="mr-eyebrow">Le parcours d’un projet</h3>
          <ol className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {HOW_IT_WORKS_STEPS.map((step) => (
              <li key={step.index} className="mr-body flex gap-4">
                <span className="mr-meta tabular-nums">{step.index}</span>
                <span className="text-mr-ink">{step.title}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/**
 * La gratuité, sur fond d'encre — la seule rupture sombre de la page.
 *
 * Le paiement en ligne des factures de l'atelier n'existe pas encore : il est
 * annoncé comme tel, avec son tarif, jamais présenté comme disponible.
 */
function Pricing() {
  return (
    <section id="tarif" className="scroll-mt-36 bg-mr-ink text-mr-paper lg:scroll-mt-28">
      <div className={`${SHELL} py-section sm:py-section-lg`}>
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <p className="mr-eyebrow">Tarif</p>
            <h2 className="mr-title mt-4 text-mr-paper">Gratuit pour votre atelier.</h2>
            <p className="mt-8 flex items-baseline gap-3">
              <span className="font-editorial text-[4.5rem] leading-none tracking-[-0.03em] sm:text-[5.5rem]">0 €</span>
              <span className="mr-lead">par mois, sans engagement</span>
            </p>
            <div className="mt-10">
              <ActionLink href={CREATE_WORKSHOP} onInk>
                Créer mon espace atelier
              </ActionLink>
            </div>
          </div>
          <div className="lg:col-span-7 lg:pt-3">
            <h3 className="mr-eyebrow">Inclus</h3>
            <ul className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
              {FREE_INCLUDES.map((item) => (
                <li key={item} className="mr-body border-t border-mr-paper/20 pt-3">
                  {item}
                </li>
              ))}
            </ul>
            <dl className="mt-12 divide-y divide-mr-paper/20 border-y border-mr-paper/20">
              <PriceRow term="Paiement direct" detail="Virement, chèque, espèces : vous encaissez comme aujourd’hui." value="0 €" />
              <PriceRow term="Paiement en ligne" detail="Facultatif, en préparation : votre client paie sa facture par carte." value="3 %" note="du montant encaissé" />
              <PriceRow term="Projets Ma Reliure" detail="Votre rémunération est annoncée avant que vous acceptiez le projet." value="Annoncée" />
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

function PriceRow({ term, detail, value, note }: { term: string; detail: string; value: ReactNode; note?: string }) {
  return (
    <div className="grid gap-2 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-8">
      <dt>
        <span className="mr-heading block text-mr-paper">{term}</span>
        <span className="mr-small mt-1 block">{detail}</span>
      </dt>
      <dd className="sm:text-right">
        <span className="font-editorial text-[1.75rem] leading-none">{value}</span>
        {note && <span className="mr-meta mt-1 block">{note}</span>}
      </dd>
    </div>
  );
}

function Faq() {
  return (
    <section>
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <div className="grid gap-10 lg:grid-cols-12 lg:items-start lg:gap-16">
          <SectionHead eyebrow="Questions fréquentes" title="Avant de créer votre espace." className="lg:sticky lg:top-32 lg:col-span-4" />
          <div className="divide-y divide-mr-rule-strong border-y border-mr-rule-strong lg:col-span-8">
            {PARTNER_FAQ.map((item) => (
              <details key={item.question} className="group py-5">
                <summary className="mr-body flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold text-mr-ink [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <span aria-hidden="true" className="mr-meta text-mr-muted group-open:hidden">+</span>
                  <span aria-hidden="true" className="mr-meta hidden text-mr-muted group-open:inline">−</span>
                </summary>
                <p className="mr-body mt-3 max-w-[40rem] text-mr-graphite">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className={`${SHELL} py-section-sm sm:py-section`}>
      <div className="max-w-[40rem]">
        <h2 className="mr-title text-mr-ink">Votre prochain devis peut partir ce soir.</h2>
        <p className="mr-lead mt-5">Créez votre espace : vos prestations sont déjà là, il ne manque que vos prix.</p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <ActionLink href={CREATE_WORKSHOP}>Créer mon espace atelier</ActionLink>
          <IntakeCta variant="outline" />
        </div>
        <p className="mr-small mt-6">Vous avez un livre à faire relier ? Le second bouton est pour vous.</p>
      </div>
    </section>
  );
}

const labelClass = "mr-small block font-semibold text-mr-ink";
const inputClass =
  "mt-2 w-full rounded-[2px] border border-mr-rule-strong bg-white px-3.5 py-3 text-[1rem] text-mr-ink";
const submitClass =
  `mt-8 w-full sm:w-auto disabled:opacity-60 ${actionClass("primary")}`;

/**
 * Champ list per the brief (§26) — délibérément différent de
 * /candidature-atelier (pas de type d'entreprise ni de CA moyen ici) : les
 * deux écrivent dans la même table via le même server function, qui traite
 * chaque champ absent comme facultatif.
 */
function ApplicationForm() {
  const submit = useServerFn(submitBinderApplication);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [workshopName, setWorkshopName] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [yearsExperience, setYearsExperience] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  // Honeypot : un champ qu'une personne ne voit jamais (voir label sr-only et
  // absence de tabIndex naturel), rempli seulement par un robot.
  const [hpCompanyName, setHpCompanyName] = useState("");

  function toggleSkill(slug: string) {
    setSkills((current) =>
      current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug],
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setProblem(null);
    try {
      await submit({
        data: {
          firstName,
          lastName,
          email,
          phone: phone || undefined,
          workshopName,
          city: city || undefined,
          websiteUrl: websiteUrl || undefined,
          skills,
          yearsExperience: yearsExperience ? Number.parseInt(yearsExperience, 10) : undefined,
          message: message || undefined,
          hpCompanyName: hpCompanyName || undefined,
        },
      });
      setSent(true);
    } catch {
      setProblem("Votre candidature n'a pas pu être envoyée. Réessayez dans un instant.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section id="candidature" className="scroll-mt-36 lg:scroll-mt-28 bg-mr-paper-warm">
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <SectionHead
          eyebrow="Sans compte"
          title="Vous préférez d'abord nous présenter votre atelier ?"
          lead="Cette candidature reste possible si vous souhaitez être recontacté avant de créer votre espace. L'accès aux projets exige toujours une validation par Ma Reliure."
        />
        <a href="/auth?space=atelier" className="mr-link mr-small mt-6 inline-block">
          Créer mon espace atelier dès maintenant
        </a>

        {sent ? (
          <p role="status" className="mr-body mt-10 max-w-[32rem]">
            Candidature envoyée. Nous la lisons et revenons vers vous.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 max-w-[36rem] space-y-6 lg:mt-14">
            {/* Piège à robots : masqué visuellement, mais lisible par un lecteur
                d'écran comme un champ à ne pas remplir, jamais par tabulation. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="pr-company">Ne pas remplir ce champ</label>
              <input
                id="pr-company"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={hpCompanyName}
                onChange={(e) => setHpCompanyName(e.target.value)}
              />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="pr-first-name" className={labelClass}>
                  Prénom
                </label>
                <input
                  id="pr-first-name"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="pr-last-name" className={labelClass}>
                  Nom
                </label>
                <input
                  id="pr-last-name"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="pr-workshop" className={labelClass}>
                Nom de l'atelier
              </label>
              <input
                id="pr-workshop"
                required
                value={workshopName}
                onChange={(e) => setWorkshopName(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="pr-city" className={labelClass}>
                  Ville
                </label>
                <input
                  id="pr-city"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="pr-email" className={labelClass}>
                  Adresse e-mail
                </label>
                <input
                  id="pr-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="pr-phone" className={labelClass}>
                  Téléphone <span className="font-normal text-mr-muted">(facultatif)</span>
                </label>
                <input
                  id="pr-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="pr-website" className={labelClass}>
                  Site ou réseau social{" "}
                  <span className="font-normal text-mr-muted">(facultatif)</span>
                </label>
                <input
                  id="pr-website"
                  type="url"
                  placeholder="https://…"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <span className={labelClass}>Savoir-faire</span>
              <div className="mt-3 flex flex-wrap gap-2">
                {BINDER_SKILLS.map((skill) => {
                  const active = skills.includes(skill.slug);
                  return (
                    <button
                      key={skill.slug}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleSkill(skill.slug)}
                      className={`mr-small border px-3 py-1.5 transition-colors ${
                        active
                          ? "border-mr-ink bg-mr-ink text-mr-paper"
                          : "border-mr-rule-strong text-mr-graphite hover:border-mr-ink"
                      }`}
                    >
                      {skill.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="pr-years" className={labelClass}>
                Années d'expérience <span className="font-normal text-mr-muted">(facultatif)</span>
              </label>
              <input
                id="pr-years"
                type="number"
                min={0}
                max={100}
                value={yearsExperience}
                onChange={(e) => setYearsExperience(e.target.value)}
                className={`${inputClass} max-w-[10rem]`}
              />
            </div>

            <div>
              <label htmlFor="pr-message" className={labelClass}>
                Votre atelier, en quelques mots{" "}
                <span className="font-normal text-mr-muted">(facultatif)</span>
              </label>
              <textarea
                id="pr-message"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className={`${inputClass} resize-none`}
                placeholder="Savoir-faire, spécialités, ce que vous cherchez en rejoignant Ma Reliure…"
              />
            </div>

            <label className="mr-small flex items-start gap-3 text-mr-graphite">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1"
              />
              <span>
                J'accepte que ces informations soient utilisées par Ma Reliure pour étudier ma
                candidature, conformément à la{" "}
                <a href="/confidentialite" className="mr-link">
                  politique de confidentialité
                </a>
                .
              </span>
            </label>

            {problem && (
              <p role="alert" className="mr-small text-mr-bordeaux">
                {problem}
              </p>
            )}

            <button type="submit" disabled={sending} className={submitClass}>
              {sending ? "Envoi…" : "Envoyer ma candidature"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
