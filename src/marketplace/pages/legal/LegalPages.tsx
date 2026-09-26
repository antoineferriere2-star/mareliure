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
import type { ComponentType, ReactNode } from "react";
import { LandingFooter, LandingHeader } from "../landing/LandingChrome";
import {
  FineBinderyFooter,
  FineBinderyHeader,
} from "@/marketplace/pages/fineBindery/FineBinderyChrome";
import {
  formatLegalPagesUpdatedAt,
  LEGAL_REVIEW_NOTE_EN,
  LEGAL_REVIEW_NOTE_FR,
  MARELIURE_CONTACT_EMAIL,
  MARELIURE_PROVIDERS,
  MARELIURE_PUBLISHER,
  MEDIATOR_PENDING_NOTE_EN,
  MEDIATOR_PENDING_NOTE_FR,
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

/** Chaque page renvoie aux autres, jamais à elle-même. */
const LEGAL_PAGES_FR = [
  { href: "/mentions-legales", label: "mentions légales" },
  { href: "/confidentialite", label: "confidentialité" },
  { href: "/conditions", label: "conditions d'utilisation" },
  { href: "/conditions-generales-de-vente", label: "conditions générales de vente" },
] as const;

/**
 * Fine Bindery's own English pages — distinct routes rather than the same
 * URL resolved by Host (unlike /auth): a legal page's URL carries its own
 * SEO identity, and a French slug ("mentions-legales") should never be the
 * canonical home for English legal text.
 */
const LEGAL_PAGES_EN = [
  { href: "/legal-notice", label: "legal notice" },
  { href: "/privacy-policy", label: "privacy policy" },
  { href: "/terms-of-use", label: "terms of use" },
  { href: "/terms-of-sale", label: "terms of sale" },
] as const;

type LegalPath = (typeof LEGAL_PAGES_FR)[number]["href"] | (typeof LEGAL_PAGES_EN)[number]["href"];

function LegalLayout({
  path,
  title,
  eyebrow,
  updatedLabel,
  seeAlso,
  intro,
  sections,
  brand = "MA_RELIURE",
}: {
  path: LegalPath;
  title: string;
  eyebrow: string;
  updatedLabel: string;
  seeAlso: string;
  intro: ReactNode;
  sections: LegalSection[];
  brand?: "MA_RELIURE" | "FINE_BINDERY";
}) {
  const siblings = (brand === "FINE_BINDERY" ? LEGAL_PAGES_EN : LEGAL_PAGES_FR).filter(
    (page) => page.href !== path,
  );
  return (
    <div className="mr-site min-h-screen bg-mr-paper text-mr-graphite">
      {brand === "FINE_BINDERY" ? <FineBinderyHeader locale="en" /> : <LandingHeader />}
      <main className={`${SHELL} py-14 sm:py-20`}>
        <p className="mr-eyebrow">{eyebrow}</p>
        <h1 className="mr-title mt-4 text-mr-ink">{title}</h1>
        <p className="mr-small mt-3">{updatedLabel}</p>
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
          aria-label={brand === "FINE_BINDERY" ? "Other legal information" : "Autres informations légales"}
          className="mr-small mt-14 border-t border-mr-rule pt-6"
        >
          {seeAlso}{" "}
          {siblings.map((page, index) => (
            <span key={page.href}>
              {index > 0 ? " · " : null}
              <a href={page.href} className="mr-link">
                {page.label}
              </a>
            </span>
          ))}
        </nav>
      </main>
      {brand === "FINE_BINDERY" ? <FineBinderyFooter locale="en" /> : <LandingFooter />}
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
      "L'équipe Ma Reliure. Les ateliers partenaires sollicités pour évaluer le travail reçoivent la description du projet et ses photos, sans vos coordonnées. Seul l'atelier retenu pour réaliser votre projet reçoit vos coordonnées.",
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
      eyebrow="Informations légales"
      updatedLabel={`Dernière mise à jour : ${formatLegalPagesUpdatedAt("fr-FR")}`}
      seeAlso="Voir aussi :"
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
      <>
        La commande, le paiement et l'acheminement de votre livre sont régis par les{" "}
        <a href="/conditions-generales-de-vente" className="mr-link">
          conditions générales de vente
        </a>
        .
      </>,
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
      eyebrow="Informations légales"
      updatedLabel={`Dernière mise à jour : ${formatLegalPagesUpdatedAt("fr-FR")}`}
      seeAlso="Voir aussi :"
      intro="Ce que vous pouvez attendre du site, et ce qu'il n'engage pas encore."
      sections={TERMS_SECTIONS}
    />
  );
}

// ---------------------------------------------------------------------------
// Conditions générales de vente (chantier GTM du 18 septembre 2026, §9)
//
// Publiées maintenant plutôt que "à venir" — voir LandingChrome.tsx. Deux
// registres de contenu, marqués distinctement :
// - Des faits : qui est partie au contrat, qui vend, qui exécute — tirés du
//   modèle réel (OPPE vend, l'atelier exécute séparément, le client paie
//   OPPE), jamais inventés.
// - Des positions juridiques (rétractation, garanties, responsabilité,
//   médiation) : formulations usuelles du secteur, explicitement marquées
//   LEGAL_REVIEW_NOTE_FR tant qu'un juriste ne les a pas validées pour OPPE.
// ---------------------------------------------------------------------------

const SALES_TERMS_SECTIONS_FR: LegalSection[] = [
  {
    heading: "Objet et champ d'application",
    body: [
      `Les présentes conditions générales de vente encadrent la commande d'une prestation de reliure, réparation, restauration, embellissement, transformation ou protection de livre auprès de Ma Reliure, une fois un prix confirmé pour votre projet. Elles complètent, sans les remplacer, les conditions d'utilisation du site et sont soumises au droit français.`,
    ],
  },
  {
    heading: "Les parties au contrat",
    body: [
      `Votre contrat de vente se forme avec ${MARELIURE_PUBLISHER.name} ("Ma Reliure"), qui vend la prestation et reste votre interlocuteur pour la commande, le paiement, le suivi et le service après-vente.`,
      "L'atelier artisanal qui réalise le travail sur votre livre est un partenaire d'exécution indépendant, sélectionné par Ma Reliure pour son savoir-faire. Il n'est pas partie à votre contrat de vente : vous ne le payez pas directement, et c'est Ma Reliure qui reste responsable envers vous de la bonne exécution de la prestation vendue.",
    ],
  },
  {
    heading: "Prix",
    body: [
      "La proposition est établie d’après les photos et les informations communiquées. L’atelier vérifie le livre à réception. Le prix convenu est celui accepté dans votre espace client, toutes taxes comprises ; aucun travail ni changement de prix ne peut être engagé sans votre accord préalable.",
      "Le prix ne devient exigible qu'une fois votre commande passée selon les modalités décrites ci-dessous ; le paiement s'effectue par carte bancaire via notre prestataire de paiement, Stripe.",
    ],
  },
  {
    heading: "Commande et formation du contrat",
    body: [
      "Le contrat de vente est formé au moment où vous validez le paiement de votre commande. Vous recevez une confirmation de commande par e-mail.",
    ],
  },
  {
    heading: "Droit de rétractation",
    body: [
      "En tant que consommateur, vous disposez en principe d'un délai de 14 jours pour vous rétracter d'un achat conclu à distance, sans avoir à vous justifier.",
      LEGAL_REVIEW_NOTE_FR +
        " En particulier : les conditions d'exercice de ce droit, ses éventuelles exceptions pour une prestation personnalisée sur votre propre livre (article L221-28 du Code de la consommation), et le formulaire type de rétractation restent à rédiger avec un juriste avant l'ouverture de toute vente réelle.",
    ],
  },
  {
    heading: "Exécution de la prestation",
    body: [
      "Ma Reliure organise la prise en charge de votre livre et sa restitution une fois la prestation réalisée, selon les modalités indiquées dans votre espace client. Un retard d'exécution vous est signalé dès qu'il est connu.",
    ],
  },
  {
    heading: "Garanties",
    body: [
      LEGAL_REVIEW_NOTE_FR +
        " Le rappel des garanties légales de conformité et des vices cachés, obligatoire sur tout contrat de vente à un consommateur (articles L217-3 et suivants, articles 1641 et suivants du Code civil), reste à rédiger avec un juriste avant l'ouverture de toute vente réelle.",
    ],
  },
  {
    heading: "Responsabilité",
    body: [
      LEGAL_REVIEW_NOTE_FR +
        " L'étendue et les limites de la responsabilité de Ma Reliure, notamment pour un livre ancien ou de valeur, restent à définir avec un juriste avant l'ouverture de toute vente réelle.",
    ],
  },
  {
    heading: "Médiation de la consommation",
    body: [MEDIATOR_PENDING_NOTE_FR],
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
    heading: "Droit applicable et litiges",
    body: [
      "Ces conditions sont soumises au droit français, sous réserve des dispositions plus protectrices dont vous bénéficiez en tant que consommateur dans votre pays de résidence.",
      <>
        Pour toute question : <Mail />.
      </>,
    ],
  },
];

export function ConditionsVentePage() {
  return (
    <LegalLayout
      path="/conditions-generales-de-vente"
      title="Conditions générales de vente"
      eyebrow="Informations légales"
      updatedLabel={`Dernière mise à jour : ${formatLegalPagesUpdatedAt("fr-FR")}`}
      seeAlso="Voir aussi :"
      intro="Ce qui régit votre commande, à partir du moment où un prix est confirmé pour votre projet."
      sections={SALES_TERMS_SECTIONS_FR}
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
      eyebrow="Informations légales"
      updatedLabel={`Dernière mise à jour : ${formatLegalPagesUpdatedAt("fr-FR")}`}
      seeAlso="Voir aussi :"
      intro="Qui édite Ma Reliure et où le site est hébergé."
      sections={NOTICE_SECTIONS}
    />
  );
}

// ---------------------------------------------------------------------------
// Fine Bindery — English legal pages
//
// Same legal entity, same facts (OPPE SAS, its SIREN, its providers) —
// translated presentation, not a second company. "Fine Bindery" replaces
// "Ma Reliure" only where the text names the *service*, never the
// publisher. These are direct translations of the French originals above
// and should get the same legal review before being treated as the
// authoritative English text (§ the file's own opening note) — and,
// separately, may need review against consumer-protection law in the
// customer's own country, which a translation alone does not resolve.
// ---------------------------------------------------------------------------

const PRIVACY_SECTIONS_EN: LegalSection[] = [
  {
    heading: "Who is responsible for your data",
    body: [
      <>
        Fine Bindery is a service published by {MARELIURE_PUBLISHER.name}, the data controller
        described here. Its full identity appears in the{" "}
        <a href="/legal-notice" className="mr-link">
          legal notice
        </a>
        .
      </>,
      <>
        For any question or request: <Mail />.
      </>,
    ],
  },
  {
    heading: "The information you give us",
    body: [
      "When you present your book: what you describe about the book and the project — title, author, nature, dimensions, condition, work requested, indicative value and budget, timeline —, the photographs you add, and your contact details: name, email address, phone number, ZIP/postal code and city.",
      "If you create a customer account: your email address and the information required to sign in.",
    ],
  },
  {
    heading: "Technical data",
    body: [
      "To limit abuse, your IP address is turned into a non-reversible fingerprint before being recorded. We do not retain the IP address itself.",
      "To measure traffic, each page visited is recorded anonymously: the page, the referring site, the language, the device type and a fingerprint renewed each day. This measurement uses no cookies.",
    ],
  },
  {
    heading: "Why we use it",
    body: [
      "To review your project, price it, select the workshop whose skills match it, respond to you and follow up on the work; to send you your project summary; to protect the service from abuse; to understand, in aggregate, how the site is used.",
    ],
  },
  {
    heading: "On what basis",
    body: [
      "Your consent, collected before your project is sent, and the pre-contractual exchanges carried out at your request. You may withdraw your consent at any time, without effect on what was done before that withdrawal.",
    ],
  },
  {
    heading: "Who has access",
    body: [
      "The Fine Bindery team. Partner workshops consulted to assess the work receive the project description and its photographs, without your contact details. Only the workshop selected to carry out your project receives your contact details.",
      "Your data is neither sold nor rented. Photographs of your book are never published.",
    ],
  },
  {
    heading: "Our providers",
    body: [
      `The application is hosted by ${MARELIURE_PROVIDERS.webHost.name}. The database and photographs are hosted by ${MARELIURE_PROVIDERS.dataHost.name}, in a region of the ${MARELIURE_PROVIDERS.dataHost.region}.`,
      `Emails, including your project summary, are sent through ${MARELIURE_PROVIDERS.email.name}'s email service, from an address on the ${MARELIURE_PROVIDERS.email.senderDomain} domain.`,
      `When you add an inspiration photograph, it is analysed by an artificial intelligence model via ${MARELIURE_PROVIDERS.ai.name}; some internal review of a project also uses it. Artificial intelligence never sets a project's price.`,
      "Some of these providers are established outside the European Union. A detailed list of subprocessors and the safeguards governing any transfers will be published on this page.",
    ],
  },
  {
    heading: "How long we keep it",
    body: [
      `The link to your project summary remains valid for ${SUMMARY_LINK_VALIDITY_DAYS} days.`,
      "Your project information is kept for as long as it is being reviewed and followed up. Final retention periods are still being set and will be shown here. You may request deletion of your data at any time.",
    ],
  },
  {
    heading: "What the site stores in your browser",
    body: [
      "A session identifier, so you can return to an interrupted project — \"Present another project\" clears it; a visit identifier, cleared when the tab is closed, for traffic measurement; and, if you have an account, your sign-in information.",
      "No advertising or third-party audience-measurement cookies are used.",
    ],
  },
  {
    heading: "Your rights",
    body: [
      "You may access your data, correct it, have it erased, restrict its processing, object to it, receive a copy in a reusable format, withdraw your consent, and set directives for its fate after your death.",
      <>
        Write to us at <Mail />. Depending on your country of residence, you may also have the
        right to lodge a complaint with your local data protection authority — in France, the
        CNIL,{" "}
        <a href="https://www.cnil.fr" className="mr-link" rel="noreferrer" target="_blank">
          www.cnil.fr
        </a>
        .
      </>,
    ],
  },
];

export function PrivacyPage() {
  return (
    <LegalLayout
      brand="FINE_BINDERY"
      path="/privacy-policy"
      title="Privacy Policy"
      eyebrow="Legal information"
      updatedLabel={`Last updated: ${formatLegalPagesUpdatedAt("en-US")}`}
      seeAlso="See also:"
      intro="What we do with the information you give us when presenting your book, and how to stay in control of it."
      sections={PRIVACY_SECTIONS_EN}
    />
  );
}

const TERMS_SECTIONS_EN: LegalSection[] = [
  {
    heading: "Purpose",
    body: [
      `These terms govern access to the Fine Bindery site and the use of its project-presentation service. The site is published by ${MARELIURE_PUBLISHER.name}.`,
    ],
  },
  {
    heading: "The service",
    body: [
      "You may present a book and describe a project — repair, restoration, binding, embellishment, transformation or protection — free of charge and without commitment. Fine Bindery reviews the work required, may offer you a price, and entrusts the project to an independent craft workshop in France whose skills match it.",
    ],
  },
  {
    heading: "No commitment at this stage",
    body: [
      "Sending a project constitutes neither an order nor an acceptance. A price only becomes firm once confirmed by Fine Bindery for your project.",
      <>
        Ordering, payment and the shipment of your book are governed by the{" "}
        <a href="/terms-of-sale" className="mr-link">
          Terms of Sale
        </a>
        .
      </>,
    ],
  },
  {
    heading: "Your information and photographs",
    body: [
      "You undertake to provide accurate information and warrant that you hold the rights to the photographs you send. These photographs are used solely to review and follow up on your project; they are never published.",
    ],
  },
  {
    heading: "Use of the site",
    body: [
      "The site must not be used abusively: automated submissions, unlawful content, attempts to access other people's data, or attempts to disrupt the service.",
    ],
  },
  {
    heading: "Intellectual property",
    body: [
      `The text, the Fine Bindery name and the site's presentation belong to ${MARELIURE_PUBLISHER.name}. Photographs of finished work belong to Atelier Reliure Dorure Ferrière, in Orléans, France, reproduced with its permission. Any reproduction without prior agreement is prohibited.`,
    ],
  },
  {
    heading: "Availability",
    body: [
      "We do our best to keep the site accessible, but cannot guarantee uninterrupted or error-free operation.",
    ],
  },
  {
    heading: "Personal data",
    body: [
      <>
        The processing of your data is described in the{" "}
        <a href="/privacy-policy" className="mr-link">
          Privacy Policy
        </a>
        .
      </>,
    ],
  },
  {
    heading: "Changes and governing law",
    body: [
      "These terms may change; the applicable version is the one published on this page. They are governed by French law, subject to any more protective provisions you benefit from as a consumer under your own country's law.",
      <>
        For any question: <Mail />.
      </>,
    ],
  },
];

export function TermsPage() {
  return (
    <LegalLayout
      brand="FINE_BINDERY"
      path="/terms-of-use"
      title="Terms of Use"
      eyebrow="Legal information"
      updatedLabel={`Last updated: ${formatLegalPagesUpdatedAt("en-US")}`}
      seeAlso="See also:"
      intro="What you can expect from the site, and what it does not yet commit to."
      sections={TERMS_SECTIONS_EN}
    />
  );
}

// ---------------------------------------------------------------------------
// Terms of Sale (GTM chantier, 18 September 2026, §9)
//
// Fine Bindery is "Worldwide service" (international: true in brandConfig.ts)
// — a customer's own country's consumer-protection law may add rights this
// page does not list, and the EU 14-day withdrawal right below only actually
// applies to a customer buying from within the EU. That variation is exactly
// why every position below (not the facts about who sells and who executes)
// carries LEGAL_REVIEW_NOTE_EN rather than a single confident paragraph.
// ---------------------------------------------------------------------------

const SALES_TERMS_SECTIONS_EN: LegalSection[] = [
  {
    heading: "Purpose and scope",
    body: [
      `These Terms of Sale govern ordering a bookbinding, repair, restoration, embellishment, transformation or protection service from Fine Bindery, once a price has been confirmed for your project. They complement, without replacing, the Terms of Use, and are governed by French law.`,
    ],
  },
  {
    heading: "The parties to the contract",
    body: [
      `Your sales contract is formed with ${MARELIURE_PUBLISHER.name} ("Fine Bindery"), which sells the service and remains your point of contact for ordering, payment, follow-up and after-sales support.`,
      "The craft workshop that carries out the work on your book is an independent execution partner, selected by Fine Bindery for its skills. It is not a party to your sales contract: you do not pay it directly, and Fine Bindery remains responsible to you for the proper execution of the service sold.",
    ],
  },
  {
    heading: "Price",
    body: [
      "The proposal is based on the photographs and information provided. The atelier checks the book on receipt. The agreed price is the one accepted in your customer space, including taxes; no work or price change proceeds without your prior agreement.",
      "The price is only due once your order is placed as described below; payment is made by card through our payment provider, Stripe.",
    ],
  },
  {
    heading: "Ordering and formation of the contract",
    body: [
      "The sales contract is formed when you complete payment for your order. You receive an order confirmation by email.",
    ],
  },
  {
    heading: "Right of withdrawal",
    body: [
      "If you are buying as a consumer within the European Union, you generally have a 14-day right to withdraw from a distance sale without giving a reason.",
      LEGAL_REVIEW_NOTE_EN +
        " In particular: the exact conditions for exercising this right, any exception for a service personalised to your own book, the standard withdrawal form, and what applies to a customer buying from outside the EU all remain to be drafted with a lawyer before any real sale opens.",
    ],
  },
  {
    heading: "Performance of the service",
    body: [
      "Fine Bindery arranges for your book to be collected and returned once the service is complete, as described in your customer space. Any delay is communicated to you as soon as it is known.",
    ],
  },
  {
    heading: "Warranties",
    body: [
      LEGAL_REVIEW_NOTE_EN +
        " The statutory conformity and hidden-defect warranties that apply under French law, and how they interact with warranties a customer may separately be entitled to under their own country's law, remain to be drafted with a lawyer before any real sale opens.",
    ],
  },
  {
    heading: "Liability",
    body: [
      LEGAL_REVIEW_NOTE_EN +
        " The scope and limits of Fine Bindery's liability, in particular for an antique or valuable book, remain to be defined with a lawyer before any real sale opens.",
    ],
  },
  {
    heading: "Consumer mediation",
    body: [MEDIATOR_PENDING_NOTE_EN],
  },
  {
    heading: "Personal data",
    body: [
      <>
        The processing of your data is described in the{" "}
        <a href="/privacy-policy" className="mr-link">
          Privacy Policy
        </a>
        .
      </>,
    ],
  },
  {
    heading: "Governing law and disputes",
    body: [
      "These terms are governed by French law, subject to any more protective provisions you benefit from as a consumer under your own country's law.",
      <>
        For any question: <Mail />.
      </>,
    ],
  },
];

export function TermsOfSalePage() {
  return (
    <LegalLayout
      brand="FINE_BINDERY"
      path="/terms-of-sale"
      title="Terms of Sale"
      eyebrow="Legal information"
      updatedLabel={`Last updated: ${formatLegalPagesUpdatedAt("en-US")}`}
      seeAlso="See also:"
      intro="What governs your order, from the moment a price is confirmed for your project."
      sections={SALES_TERMS_SECTIONS_EN}
    />
  );
}

const NOTICE_SECTIONS_EN: LegalSection[] = [
  {
    heading: "Publisher",
    body: [
      `Fine Bindery is a service published by ${MARELIURE_PUBLISHER.name}, a French ${MARELIURE_PUBLISHER.legalForm} with a share capital of ${MARELIURE_PUBLISHER.capital}.`,
      `Registered office: ${MARELIURE_PUBLISHER.address}, France.`,
      `SIREN: ${MARELIURE_PUBLISHER.siren} — SIRET (head office): ${MARELIURE_PUBLISHER.siret}. ${MARELIURE_PUBLISHER.rcs}. Intra-EU VAT number: ${MARELIURE_PUBLISHER.vat}.`,
      <>
        Contact: <Mail />.
      </>,
    ],
  },
  {
    heading: "Publication director",
    body: [`The legal representative of ${MARELIURE_PUBLISHER.name}.`],
  },
  {
    heading: "Hosting",
    body: [
      `Site: ${MARELIURE_PROVIDERS.webHost.name}, ${MARELIURE_PROVIDERS.webHost.address}.`,
      `Data and photographs: ${MARELIURE_PROVIDERS.dataHost.name}, ${MARELIURE_PROVIDERS.dataHost.region} region.`,
    ],
  },
  {
    heading: "Photo credits",
    body: ["Atelier Reliure Dorure Ferrière, Orléans, France."],
  },
];

export function LegalNoticePage() {
  return (
    <LegalLayout
      brand="FINE_BINDERY"
      path="/legal-notice"
      title="Legal Notice"
      eyebrow="Legal information"
      updatedLabel={`Last updated: ${formatLegalPagesUpdatedAt("en-US")}`}
      seeAlso="See also:"
      intro="Who publishes Fine Bindery, and where the site is hosted."
      sections={NOTICE_SECTIONS_EN}
    />
  );
}
