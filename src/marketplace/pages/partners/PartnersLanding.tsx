/**
 * `/partenaires-relieurs` — la page qui recrute des ateliers, pas celle qui
 * recrute des clients (ReliureLanding.tsx). Même conteneur, même typographie,
 * même interdiction de chiffre inventé (§59 partagé avec la landing) : aucun
 * nombre d'ateliers, aucun témoignage, aucun logo, parce qu'aucun n'est réel
 * au lancement.
 *
 * Deux sections sont volontairement écrites au futur : la répartition 80/20
 * (Stripe Connect n'est pas branché) et la vitrine `/ateliers/:slug` (jamais
 * construite). Le reste décrit ce qui existe déjà et fonctionne en
 * production : invitation de membres, messagerie, décisions, lien de parrainage
 * personnel.
 */
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { IntakeCta, LandingFooter, LandingHeader, SectionHead, SHELL } from "@/marketplace/pages/landing/LandingChrome";
import { usePageViewTracking } from "@/build/pages/public/usePageViewTracking";
import { submitBinderApplication } from "@/marketplace/services/binderApplications.data.functions";
import { BINDER_SKILLS } from "@/marketplace/binders/skills";
import {
  BENEFITS,
  HOW_IT_WORKS_STEPS,
  OFFER_ROWS,
  PARTNER_FAQ,
  WORKSPACE_CAPABILITIES,
} from "@/marketplace/pages/landing/partnersContent";

export function PartnersLandingPage() {
  usePageViewTracking();
  return (
    <div className="mr-site flex min-h-screen flex-col bg-mr-paper text-mr-graphite">
      <LandingHeader />
      <main>
        <Hero />
        <Benefits />
        <VagueRequestProblem />
        <HowItWorks />
        <Workspace />
        <DecisionsExample />
        <InviteYourClients />
        <BackOffice />
        <WorkshopShowcase />
        <NoCustomSite />
        <CollectiveSeo />
        <Matching />
        <Remuneration />
        <PayoutSplit />
        <UnexpectedIssues />
        <TransportRisk />
        <WhatWeLookFor />
        <OfferSummary />
        <ApplicationForm />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className={`${SHELL} pt-14 pb-16 sm:pt-20 sm:pb-20 lg:pt-24 lg:pb-24`}>
      <p className="mr-eyebrow">Pour les ateliers de reliure</p>
      <h1 className="mr-display mt-6 max-w-[38rem] text-mr-ink">
        Des projets qualifiés, pas des devis dans le vide.
      </h1>
      <p className="mr-lead mt-7 max-w-[36rem]">
        Ma Reliure vous adresse des livres déjà photographiés, décrits et acceptés à un prix connu.
        Vous gardez votre atelier, votre nom, et le choix d'accepter ou non chaque projet.
      </p>
      <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
        <a href="#candidature" className="mr-tap inline-flex items-center justify-center rounded-[2px] bg-mr-ink px-7 py-4 text-[0.9375rem] font-semibold tracking-[0.01em] text-mr-paper transition-colors duration-200 hover:bg-mr-walnut">
          Présenter mon atelier
        </a>
        <a href="#comment-ca-marche-relieur" className="mr-link mr-tap text-[1.0625rem]">
          Voir comment ça marche
        </a>
      </div>
    </section>
  );
}

function Benefits() {
  return (
    <section className="bg-mr-paper-warm">
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <SectionHead
          eyebrow="Ce que ça change"
          title="Un atelier qui reçoit du travail, pas qui en cherche."
        />
        <div className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:mt-16">
          {BENEFITS.map((benefit, index) => (
            <div key={benefit.title} className="border-t border-mr-rule pt-5">
              <span className="mr-meta tabular-nums">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="mr-heading mt-3 text-mr-ink">{benefit.title}</h3>
              <p className="mr-body mt-2">{benefit.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Le problème que Ma Reliure résout, illustré plutôt qu'affirmé : deux
 * demandes, une vague et une qualifiée, côte à côte. Aucune n'est une capture
 * d'écran ni une citation réelle — un exemple générique, présenté comme tel.
 */
function VagueRequestProblem() {
  return (
    <section className={`${SHELL} py-section-sm sm:py-section`}>
      <SectionHead
        eyebrow="Le problème habituel"
        title="« Bonjour, j'ai un vieux livre abîmé, combien ça coûte ? »"
        lead="Une demande par e-mail ou téléphone oblige à deviner l'état du livre, le travail réel et le budget de la personne avant de pouvoir répondre. Ma Reliure qualifie la demande avant de vous la transmettre."
      />
      <div className="mt-12 grid gap-6 lg:mt-16 lg:grid-cols-2">
        <div className="border border-mr-rule-strong p-6">
          <p className="mr-meta text-mr-muted">Exemple — demande non qualifiée</p>
          <p className="mr-body mt-3 italic text-mr-graphite">
            « Bonjour, j'ai un vieux livre abîmé, vous pouvez me dire combien ça coûte ? »
          </p>
          <p className="mr-small mt-4 text-mr-muted">
            Ni photo, ni dimensions, ni degré d'urgence : impossible de chiffrer sans un échange
            supplémentaire.
          </p>
        </div>
        <div className="border border-mr-ink p-6">
          <p className="mr-meta text-mr-muted">Ce que reçoit l'atelier via Ma Reliure</p>
          <ul className="mr-body mt-3 space-y-2">
            <li>Photographies du livre, sous plusieurs angles</li>
            <li>Format, état général et travail demandé</li>
            <li>Prix déjà accepté par le client</li>
            <li>Délai souhaité</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="comment-ca-marche-relieur" className="scroll-mt-24 bg-mr-paper-warm">
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <SectionHead eyebrow="Le parcours d'un projet" title="De la présentation du livre à son retour." />
        <ol className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map((step) => (
            <li key={step.index} className="border-t border-mr-rule-strong pt-5">
              <span className="mr-meta tabular-nums">{step.index}</span>
              <p className="mr-heading mt-3 text-mr-ink">{step.title}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * Pas de capture d'écran : aucun atelier réel ne s'est encore connecté à cet
 * espace en production, et en fabriquer une serait exactement l'interface
 * inventée que le brief interdit. La liste décrit ce que l'espace contient
 * réellement (services/marketplace.data.functions.ts, BinderDashboardPage).
 */
function Workspace() {
  return (
    <section className={`${SHELL} py-section-sm sm:py-section`}>
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-5">
          <SectionHead
            eyebrow="Votre espace atelier"
            title="Tout le suivi au même endroit."
            lead="Un tableau de bord réunit les projets proposés, en cours et terminés — sans jongler entre e-mails, SMS et carnet papier."
          />
        </div>
        <div className="lg:col-span-7">
          <ul className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
            {WORKSPACE_CAPABILITIES.map((capability) => (
              <li key={capability.label} className="border-t border-mr-rule-strong pt-4">
                <span className="mr-small font-semibold text-mr-ink">{capability.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/**
 * Mockup explicitement permis par le brief : illustrer la messagerie et les
 * décisions structurées sans capture réelle. Étiqueté comme un exemple, pas
 * une donnée.
 */
function DecisionsExample() {
  return (
    <section className="bg-mr-paper-warm">
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <SectionHead
          eyebrow="Messages et décisions"
          title="Chaque validation reste écrite, jamais perdue dans un échange oral."
          lead="Une question posée au client (couleur, matière, texte de dorure) devient une décision datée et conservée dans le dossier — exemple ci-dessous, pas une donnée réelle."
        />
        <div className="mt-12 max-w-[30rem] border border-mr-rule-strong bg-mr-paper p-5 lg:mt-16">
          <p className="mr-meta text-mr-brass">Décision · Action requise</p>
          <p className="mr-body mt-2 font-medium text-mr-ink">
            Quelle couleur de cuir pour la reliure ?
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Bordeaux", "Noir", "Brun cognac"].map((option) => (
              <span
                key={option}
                className="mr-small border border-mr-rule-strong px-3 py-1.5 text-mr-graphite"
              >
                {option}
              </span>
            ))}
          </div>
          <p className="mr-meta mt-4 text-mr-muted">Exemple illustratif — aucun dossier réel</p>
        </div>
      </div>
    </section>
  );
}

/**
 * Priorisée visuellement (fond encre, comme les engagements de la landing
 * client) : c'est l'argument le plus fort pour un atelier qui a déjà ses
 * propres clients et ne veut pas les perdre en les envoyant sur Ma Reliure.
 */
function InviteYourClients() {
  return (
    <section className="bg-mr-ink text-mr-paper">
      <div className={`${SHELL} py-section sm:py-section-lg`}>
        <SectionHead
          eyebrow="Vos propres clients"
          title="Invitez vos clients, ils restent vos clients."
          lead="Votre atelier a un lien personnel : mareliure.fr/a/votre-atelier. Un client que vous y envoyez présente son livre normalement, et le dossier arrive directement dans votre espace — jamais proposé à un autre atelier."
          tone="paper"
        />
        <p className="mr-body mt-8 max-w-[38rem] text-mr-paper/90">
          Vous gagnez le suivi structuré (messages, photos, décisions, rémunération) pour des
          clients que vous avez trouvés vous-même, sans changer votre façon de travailler avec eux.
        </p>
      </div>
    </section>
  );
}

function BackOffice() {
  return (
    <section className={`${SHELL} py-section-sm sm:py-section`}>
      <SectionHead
        eyebrow="Côté Ma Reliure"
        title="Une équipe qui qualifie et qui tranche, pas seulement une plateforme."
        lead="Chaque candidature est lue par une personne. Chaque demande client est vérifiée avant d'être proposée à un atelier. En cas de désaccord ou de problème après réception, Ma Reliure reprend la discussion commerciale avec le client — ce n'est jamais à vous de renégocier."
      />
    </section>
  );
}

/**
 * Devra être remplacée par de vraies vitrines (`/ateliers/:slug`, jamais
 * construites) une fois qu'un atelier existe en production. En attendant,
 * la section dit ce qui est prévu au futur, sans donner d'URL qui 404.
 */
function WorkshopShowcase() {
  return (
    <section className="bg-mr-paper-warm">
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <SectionHead
          eyebrow="Votre vitrine"
          title="Une page à votre nom, sur Ma Reliure."
          lead="Chaque atelier partenaire disposera d'une vitrine publique — votre histoire, vos savoir-faire, vos réalisations — visible des clients qui présentent un livre. Elle sera mise en place avec les premiers ateliers du réseau."
        />
      </div>
    </section>
  );
}

function NoCustomSite() {
  return (
    <section className={`${SHELL} py-section-sm sm:py-section`}>
      <SectionHead
        eyebrow="Ce que Ma Reliure n'est pas"
        title="Pas un site sur mesure, pas une marque à votre nom."
        lead="La vitrine suit un format commun à tous les ateliers du réseau : ni branding personnalisé, ni nom de domaine dédié. C'est ce qui permet à Ma Reliure de porter la visibilité collective plutôt qu'à chaque atelier de construire la sienne seul."
      />
    </section>
  );
}

function CollectiveSeo() {
  return (
    <section className="bg-mr-paper-warm">
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <SectionHead
          eyebrow="Visibilité"
          title="Un site qui se positionne pour vous, pas quatorze sites qui se concurrencent."
          lead="Un client qui cherche « reliure ancienne » ou « restaurer un livre abîmé » trouve Ma Reliure, pas un atelier isolé sur une première page de recherche déjà occupée par de plus gros acteurs. Rejoindre le réseau, c'est profiter de cette visibilité commune plutôt que de la construire seul."
        />
      </div>
    </section>
  );
}

function Matching() {
  return (
    <section className={`${SHELL} py-section-sm sm:py-section`}>
      <SectionHead
        eyebrow="Comment les projets sont attribués"
        title="Le bon savoir-faire, pas le moins cher."
        lead="Ma Reliure attribue chaque projet à l'atelier dont les compétences déclarées correspondent au travail demandé — reliure, restauration, dorure, cartonnage. Il n'y a pas d'enchère entre ateliers, et le prix payé à l'atelier n'est jamais mis en concurrence avec un autre partenaire sur le même dossier."
      />
    </section>
  );
}

function Remuneration() {
  return (
    <section className="bg-mr-paper-warm">
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <SectionHead
          eyebrow="Rémunération"
          title="Vous connaissez le montant avant d'accepter."
          lead="Ma Reliure fixe le prix présenté au client. Avant d'accepter un projet, vous voyez la rémunération proposée pour ce travail précis — vous n'avez pas à publier de grille tarifaire ni à négocier directement avec le client."
        />
      </div>
    </section>
  );
}

/**
 * Volontairement au futur et sans chiffre engageant : Stripe Connect n'est
 * pas branché (audit initial), et annoncer un taux de répartition figé serait
 * décrire un mécanisme de paiement qui n'existe pas encore.
 */
function PayoutSplit() {
  return (
    <section className={`${SHELL} py-section-sm sm:py-section`}>
      <SectionHead
        eyebrow="Paiement — à venir"
        title="Un versement direct, en cours de mise en place."
        lead="Ma Reliure prépare un paiement automatisé de votre rémunération dès la fin du projet, avec une répartition claire entre l'atelier et la plateforme. Tant que ce circuit n'est pas actif, chaque versement est organisé individuellement avec les premiers ateliers du réseau."
      />
    </section>
  );
}

function UnexpectedIssues() {
  return (
    <section className="bg-mr-paper-warm">
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <SectionHead
          eyebrow="En cas d'imprévu"
          title="Un problème découvert après réception ne devient jamais votre négociation."
          lead="Livre plus abîmé que décrit, pièce manquante, travail finalement hors de votre champ : vous le signalez dans le dossier avec des photos. Ma Reliure reprend l'échange commercial avec le client avant toute modification du périmètre ou du prix."
        />
      </div>
    </section>
  );
}

function TransportRisk() {
  return (
    <section className={`${SHELL} py-section-sm sm:py-section`}>
      <SectionHead
        eyebrow="Transport"
        title="Le trajet du livre est pensé selon sa valeur, pas au même tarif pour tous."
        lead="Un livre courant et un ouvrage ancien à forte valeur ne voyagent pas dans les mêmes conditions. Ma Reliure adapte l'emballage, l'assurance et le mode d'envoi au niveau de risque du livre concerné, à l'aller comme au retour."
      />
    </section>
  );
}

function WhatWeLookFor() {
  return (
    <section className="bg-mr-paper-warm">
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <SectionHead
          eyebrow="Ce que nous cherchons"
          title="Des ateliers installés, pas une liste de critères impossibles."
          lead="Un atelier en activité en France, quel que soit son statut juridique ou sa taille. Un savoir-faire reconnaissable — réparation, restauration, reliure, dorure, cartonnage, création. Aucun volume minimum n'est exigé pour candidater."
        />
      </div>
    </section>
  );
}

function OfferSummary() {
  return (
    <section className={`${SHELL} py-section-sm sm:py-section`}>
      <SectionHead eyebrow="En résumé" title="Ce que propose Ma Reliure à un atelier partenaire." />
      <div className="mt-10 overflow-x-auto lg:mt-14">
        <table className="w-full min-w-[28rem] border-collapse text-left">
          <tbody>
            {OFFER_ROWS.map((row) => (
              <tr key={row.label} className="border-t border-mr-rule-strong">
                <th scope="row" className="mr-body py-4 pr-6 font-semibold text-mr-ink">
                  {row.label}
                </th>
                <td className="mr-body py-4 text-mr-graphite">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="bg-mr-paper-warm">
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <SectionHead eyebrow="Questions fréquentes" title="Avant de candidater." />
        <div className="mt-10 max-w-[42rem] divide-y divide-mr-rule-strong lg:mt-14">
          {PARTNER_FAQ.map((item) => (
            <details key={item.question} className="group py-5">
              <summary className="mr-body flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-mr-ink">
                {item.question}
                <span aria-hidden="true" className="mr-meta text-mr-muted group-open:hidden">
                  +
                </span>
                <span aria-hidden="true" className="mr-meta hidden text-mr-muted group-open:inline">
                  −
                </span>
              </summary>
              <p className="mr-body mt-3 text-mr-graphite">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className={`${SHELL} py-section-sm text-center sm:py-section`}>
      <h2 className="mr-title mx-auto max-w-[32rem] text-mr-ink">
        Rejoignez un réseau d'ateliers indépendants, sans perdre votre indépendance.
      </h2>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
        <a
          href="#candidature"
          className="mr-tap inline-flex items-center justify-center rounded-[2px] bg-mr-ink px-7 py-4 text-[0.9375rem] font-semibold tracking-[0.01em] text-mr-paper transition-colors duration-200 hover:bg-mr-walnut"
        >
          Présenter mon atelier
        </a>
        <IntakeCta variant="outline" />
      </div>
    </section>
  );
}

const labelClass = "mr-small block font-semibold text-mr-ink";
const inputClass =
  "mt-2 w-full rounded-[2px] border border-mr-rule-strong bg-white px-3.5 py-3 text-[1rem] text-mr-ink";
const submitClass =
  "mt-8 inline-flex w-full items-center justify-center rounded-[2px] bg-mr-ink px-6 py-3.5 text-[0.9375rem] font-semibold tracking-[0.01em] text-mr-paper transition-colors duration-200 hover:bg-mr-graphite disabled:opacity-60 sm:w-auto";

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
    <section id="candidature" className="scroll-mt-24 bg-mr-paper-warm">
      <div className={`${SHELL} py-section-sm sm:py-section`}>
        <SectionHead
          eyebrow="Candidater"
          title="Présentez votre atelier."
          lead="Ma Reliure lit chaque candidature et vous recontacte — aucun compte n'est créé avant que nous ne vous contactions."
        />

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
