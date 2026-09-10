/**
 * Les pages légales de Ma Reliure.
 *
 * Elles remplacent, dans le tunnel, des liens vers les pages de Métré Build en
 * anglais — la politique d'un autre service, dans une autre langue, sur
 * l'écran même où quelqu'un consentait au traitement de ses données.
 *
 * Deux règles de rédaction, qui comptent plus que le style :
 *
 * - **Rien d'inventé.** Chaque affirmation factuelle correspond à ce que le
 *   code fait : les prestataires sont ceux qu'il appelle, la durée de 90 jours
 *   est celle du lien de récapitulatif, l'empreinte d'IP est salée parce que
 *   le code la sale. Là où une décision n'a pas encore été prise — durées de
 *   conservation, liste détaillée des sous-traitants —, la page le dit.
 * - **Pas de promesse commerciale déguisée.** Les conditions d'utilisation
 *   décrivent le dépôt d'un projet, qui existe. La commande, le paiement et
 *   l'expédition, qui n'existent pas, relèveront de conditions de vente
 *   publiées avant leur ouverture.
 *
 * Ces textes gagneraient à être relus par un juriste : ils sont exacts, pas
 * encore révisés.
 */
import type { ReactNode } from "react";
import { LandingFooter, LandingHeader } from "../landing/LandingChrome";
import {
  LEGAL_PAGES_UPDATED_AT,
  MARELIURE_CONTACT_EMAIL,
  MARELIURE_PROVIDERS,
  MARELIURE_PUBLISHER,
  SUMMARY_LINK_VALIDITY_DAYS,
} from "@/marketplace/legal/legalEntity";

const SHELL = "mx-auto w-full max-w-[46rem] px-5 sm:px-8";

interface LegalSection {
  heading: string;
  body: ReactNode[];
}

const Mail = () => (
  <a href={`mailto:${MARELIURE_CONTACT_EMAIL}`} className="mr-link">
    {MARELIURE_CONTACT_EMAIL}
  </a>
);

/** Chaque page renvoie aux deux autres, jamais à elle-même. */
const LEGAL_PAGES = [
  { href: "/mentions-legales", label: "mentions légales" },
  { href: "/confidentialite", label: "confidentialité" },
  { href: "/conditions", label: "conditions d'utilisation" },
] as const;

type LegalPath = (typeof LEGAL_PAGES)[number]["href"];

function LegalLayout({
  path,
  title,
  intro,
  sections,
}: {
  path: LegalPath;
  title: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <div className="mr-site min-h-screen bg-mr-paper text-mr-graphite">
      <LandingHeader />
      <main className={`${SHELL} py-14 sm:py-20`}>
        <p className="mr-eyebrow">Informations légales</p>
        <h1 className="mr-title mt-4 text-mr-ink">{title}</h1>
        <p className="mr-small mt-3">Dernière mise à jour : {LEGAL_PAGES_UPDATED_AT}</p>
        <div className="mr-lead mt-8">{intro}</div>
        <div className="mt-12 space-y-10">
          {sections.map((section) => (
            <section key={section.heading} className="border-t border-mr-rule pt-6">
              <h2 className="mr-heading text-mr-ink">{section.heading}</h2>
              <div className="mr-body mt-3 space-y-3">
                {section.body.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
        <nav
          aria-label="Autres informations légales"
          className="mr-small mt-14 border-t border-mr-rule pt-6"
        >
          Voir aussi :{" "}
          {LEGAL_PAGES.filter((page) => page.href !== path).map((page, index) => (
            <span key={page.href}>
              {index > 0 ? " · " : null}
              <a href={page.href} className="mr-link">
                {page.label}
              </a>
            </span>
          ))}
        </nav>
      </main>
      <LandingFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confidentialité
// ---------------------------------------------------------------------------

const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: "Qui est responsable de vos données",
    body: [
      <>
        Ma Reliure est un service édité par {MARELIURE_PUBLISHER.name}, responsable du traitement
        des données décrites ici. Son identité complète figure dans les{" "}
        <a href="/mentions-legales" className="mr-link">
          mentions légales
        </a>
        .
      </>,
      <>
        Pour toute question ou demande : <Mail />.
      </>,
    ],
  },
  {
    heading: "Les informations que vous nous confiez",
    body: [
      "En présentant votre livre : ce que vous décrivez de l'ouvrage et du projet — titre, auteur, nature, dimensions, état, travaux souhaités, valeur et budget indicatifs, délai —, les photos que vous ajoutez, et vos coordonnées : nom, adresse e-mail, téléphone, code postal et ville.",
      "Si vous créez un compte client : votre adresse e-mail et les informations nécessaires à la connexion.",
    ],
  },
  {
    heading: "Les données techniques",
    body: [
      "Pour limiter les abus, votre adresse IP est transformée en une empreinte non réversible avant d'être enregistrée. Nous ne conservons pas l'adresse IP elle-même.",
      "Pour mesurer la fréquentation, chaque page consultée est enregistrée de façon anonyme : la page, le site de provenance, la langue, le type d'appareil et une empreinte renouvelée chaque jour. Cette mesure n'utilise aucun cookie.",
    ],
  },
  {
    heading: "Pourquoi nous les utilisons",
    body: [
      "Étudier votre projet, en établir le prix, sélectionner l'atelier dont le savoir-faire lui correspond, vous répondre et suivre le travail ; vous envoyer le récapitulatif de votre projet ; protéger le service contre les abus ; comprendre, de façon agrégée, comment le site est utilisé.",
    ],
  },
  {
    heading: "Sur quelle base",
    body: [
      "Votre consentement, recueilli avant l'envoi de votre projet, et les échanges précontractuels menés à votre demande. Vous pouvez retirer votre consentement à tout moment, sans effet sur ce qui a été fait avant ce retrait.",
    ],
  },
  {
    heading: "Qui y a accès",
    body: [
      "L'équipe Ma Reliure. Les ateliers partenaires sollicités pour évaluer le travail reçoivent la description du projet et ses photos, sans vos coordonnées, et n'y ont plus accès s'ils ne sont pas retenus. Seul l'atelier retenu pour réaliser votre projet reçoit vos coordonnées.",
      "Une fois l'atelier retenu, vous échangez avec lui depuis votre espace Ma Reliure. Ces messages, les photos qui les accompagnent et les choix que vous y confirmez sont conservés dans le dossier de votre livre. L'équipe Ma Reliure peut les consulter pour suivre votre commande et vous assister.",
      "Vos données ne sont ni vendues ni louées. Les photos de votre livre ne sont jamais publiées.",
    ],
  },
  {
    heading: "Nos prestataires",
    body: [
      `L'application est hébergée par ${MARELIURE_PROVIDERS.webHost.name}. La base de données et les photos sont hébergées par ${MARELIURE_PROVIDERS.dataHost.name}, dans une région de l'${MARELIURE_PROVIDERS.dataHost.region}.`,
      `Les e-mails, dont le récapitulatif de votre projet, sont envoyés par le service de messagerie de ${MARELIURE_PROVIDERS.email.name}, depuis une adresse du domaine ${MARELIURE_PROVIDERS.email.senderDomain}.`,
      `Lorsque vous ajoutez une photo d'inspiration, elle est analysée par un modèle d'intelligence artificielle via ${MARELIURE_PROVIDERS.ai.name} ; certaines analyses internes d'un dossier y recourent aussi. L'intelligence artificielle ne fixe jamais le prix d'un projet.`,
      "Certains de ces prestataires sont établis hors de l'Union européenne. La liste détaillée des sous-traitants et des garanties encadrant d'éventuels transferts sera publiée sur cette page.",
    ],
  },
  {
    heading: "Combien de temps nous les conservons",
    body: [
      `Le lien vers le récapitulatif de votre projet reste valable ${SUMMARY_LINK_VALIDITY_DAYS} jours.`,
      "Les informations de votre projet sont conservées le temps de son étude et de son suivi. Les durées de conservation définitives sont en cours de fixation et seront indiquées ici. Vous pouvez demander la suppression de vos données à tout moment.",
    ],
  },
  {
    heading: "Ce que le site enregistre dans votre navigateur",
    body: [
      "Un identifiant de session, pour que vous retrouviez un projet interrompu — « Présenter un autre projet » l'efface ; un identifiant de visite, effacé à la fermeture de l'onglet, pour la mesure de fréquentation ; et, si vous avez un compte, les informations de connexion.",
      "Aucun cookie publicitaire ni de mesure d'audience tierce n'est utilisé.",
    ],
  },
  {
    heading: "Vos droits",
    body: [
      "Vous pouvez accéder à vos données, les rectifier, les faire effacer, en limiter le traitement, vous y opposer, en recevoir une copie dans un format réutilisable, retirer votre consentement et définir des directives sur leur sort après votre décès.",
      <>
        Écrivez-nous à <Mail />. Vous pouvez aussi adresser une réclamation à la CNIL,{" "}
        <a href="https://www.cnil.fr" className="mr-link" rel="noreferrer" target="_blank">
          www.cnil.fr
        </a>
        .
      </>,
    ],
  },
];

export function ConfidentialitePage() {
  return (
    <LegalLayout
      path="/confidentialite"
      title="Politique de confidentialité"
      intro="Ce que nous faisons des informations que vous nous confiez en présentant votre livre, et comment garder la main dessus."
      sections={PRIVACY_SECTIONS}
    />
  );
}

// ---------------------------------------------------------------------------
// Conditions d'utilisation
// ---------------------------------------------------------------------------

const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: "Objet",
    body: [
      `Ces conditions encadrent l'accès au site Ma Reliure et l'utilisation de son service de présentation de projet. Le site est édité par ${MARELIURE_PUBLISHER.name}.`,
    ],
  },
  {
    heading: "Le service",
    body: [
      "Vous pouvez présenter un livre et décrire un projet — réparation, restauration, reliure, embellissement, transformation ou protection — gratuitement et sans engagement. Ma Reliure étudie le travail à réaliser, peut vous proposer un prix et confie le projet à un atelier artisanal indépendant dont le savoir-faire lui correspond.",
    ],
  },
  {
    heading: "Aucun engagement à ce stade",
    body: [
      "L'envoi d'un projet ne constitue ni une commande, ni une acceptation. Un prix ne devient ferme qu'une fois confirmé par Ma Reliure pour votre projet.",
      "La commande, le paiement et l'acheminement de votre livre feront l'objet de conditions générales de vente, publiées avant l'ouverture de ces services.",
    ],
  },
  {
    heading: "Le suivi de votre projet",
    body: [
      "Une fois l'atelier retenu, la conversation avec lui se tient dans votre espace Ma Reliure, dans le cadre du service. Elle sert à la réalisation de votre livre : les coordonnées, le paiement et toute modification du prix n'y passent pas, et Ma Reliure peut en prendre connaissance pour le suivi et l'assistance.",
      "Les choix que vous confirmez dans votre espace — une couleur, un papier, un texte à dorer — sont enregistrés dans le dossier de votre livre et transmis à l'atelier.",
    ],
  },
  {
    heading: "Vos informations et vos photos",
    body: [
      "Vous vous engagez à fournir des informations exactes et garantissez disposer des droits sur les photos que vous envoyez. Ces photos servent uniquement à étudier et suivre votre projet ; elles ne sont jamais publiées.",
    ],
  },
  {
    heading: "Utilisation du site",
    body: [
      "Le site ne doit pas être utilisé de façon abusive : envois automatisés, contenus illicites, tentative d'accès aux données d'autrui ou de perturbation du service.",
    ],
  },
  {
    heading: "Propriété intellectuelle",
    body: [
      `Les textes, le nom Ma Reliure et la présentation du site appartiennent à ${MARELIURE_PUBLISHER.name}. Les photographies des réalisations sont celles de l'Atelier Reliure Dorure Ferrière, à Orléans, reproduites avec son autorisation. Toute reproduction sans accord préalable est interdite.`,
    ],
  },
  {
    heading: "Disponibilité",
    body: [
      "Nous faisons notre possible pour que le site reste accessible, sans pouvoir garantir un fonctionnement ininterrompu ou exempt d'erreur.",
    ],
  },
  {
    heading: "Données personnelles",
    body: [
      <>
        Le traitement de vos données est décrit dans la{" "}
        <a href="/confidentialite" className="mr-link">
          politique de confidentialité
        </a>
        .
      </>,
    ],
  },
  {
    heading: "Évolution et droit applicable",
    body: [
      "Ces conditions peuvent évoluer ; la version applicable est celle publiée sur cette page. Elles sont soumises au droit français, sous réserve des dispositions plus protectrices dont vous bénéficiez en tant que consommateur.",
      <>
        Pour toute question : <Mail />.
      </>,
    ],
  },
];

export function ConditionsPage() {
  return (
    <LegalLayout
      path="/conditions"
      title="Conditions d'utilisation"
      intro="Ce que vous pouvez attendre du site, et ce qu'il n'engage pas encore."
      sections={TERMS_SECTIONS}
    />
  );
}

// ---------------------------------------------------------------------------
// Mentions légales
// ---------------------------------------------------------------------------

const NOTICE_SECTIONS: LegalSection[] = [
  {
    heading: "Éditeur",
    body: [
      `Ma Reliure est un service édité par ${MARELIURE_PUBLISHER.name}, ${MARELIURE_PUBLISHER.legalFormInSentence} au capital de ${MARELIURE_PUBLISHER.capital}.`,
      `Siège social : ${MARELIURE_PUBLISHER.address}.`,
      `SIREN : ${MARELIURE_PUBLISHER.siren} — SIRET (siège) : ${MARELIURE_PUBLISHER.siret}. ${MARELIURE_PUBLISHER.rcs}. N° TVA intracommunautaire : ${MARELIURE_PUBLISHER.vat}.`,
      <>
        Contact : <Mail />.
      </>,
    ],
  },
  {
    heading: "Directeur de la publication",
    body: [`Le représentant légal de ${MARELIURE_PUBLISHER.name}.`],
  },
  {
    heading: "Hébergement",
    body: [
      `Site : ${MARELIURE_PROVIDERS.webHost.name}, ${MARELIURE_PROVIDERS.webHost.address}.`,
      `Données et photos : ${MARELIURE_PROVIDERS.dataHost.name}, région ${MARELIURE_PROVIDERS.dataHost.region}.`,
    ],
  },
  {
    heading: "Crédits photographiques",
    body: ["Atelier Reliure Dorure Ferrière, Orléans."],
  },
];

export function MentionsLegalesPage() {
  return (
    <LegalLayout
      path="/mentions-legales"
      title="Mentions légales"
      intro="Qui édite Ma Reliure et où le site est hébergé."
      sections={NOTICE_SECTIONS}
    />
  );
}
