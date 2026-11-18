import type { FineBinderyLocale } from "../i18n/fineBinderyLocale";

import type { FineBinderyLegalSlug } from "./fineBinderyLegalPaths";
export type TranslatedLegalLocale = Exclude<FineBinderyLocale, "en">;
export interface LegalTranslation {
  title: string;
  description: string;
  sections: { heading: string; body: string[] }[];
}
export interface LegalLocaleCopy {
  eyebrow: string;
  updated: string;
  seeAlso: string;
  other: string;
  pages: Record<FineBinderyLegalSlug, LegalTranslation>;
}

// Traductions de LegalPages.tsx (anglais), sans révision des clauses ni des faits.
// Les marqueurs lisent l'identité commune et créent des liens dans la langue courante.
export const FINE_BINDERY_LEGAL_TRANSLATIONS: Record<TranslatedLegalLocale, LegalLocaleCopy> = {
  fr: {
    eyebrow: "Informations légales",
    updated: "Dernière mise à jour :",
    seeAlso: "Voir aussi :",
    other: "Autres informations légales",
    pages: {
      "legal-notice": {
        title: "Mentions légales",
        description: "Qui édite Fine Bindery et où le site est hébergé.",
        sections: [
          {
            heading: "Éditeur",
            body: [
              "Fine Bindery est un service édité par {{name}}, société française de forme {{form}}, au capital de {{capital}}.",
              "Siège social : {{address}}, France.",
              "SIREN : {{siren}} — SIRET (siège) : {{siret}}. {{rcs}}. Numéro de TVA intracommunautaire : {{vat}}.",
              "Contact : {{mail}}.",
            ],
          },
          { heading: "Directeur de la publication", body: ["Le représentant légal de {{name}}."] },
          {
            heading: "Hébergement",
            body: [
              "Site : {{webHost}}, {{webAddress}}.",
              "Données et photographies : {{dataHost}}, région {{region}}.",
            ],
          },
          {
            heading: "Crédits photographiques",
            body: ["Atelier Reliure Dorure Ferrière, Orléans, France."],
          },
        ],
      },
      "privacy-policy": {
        title: "Politique de confidentialité",
        description:
          "Ce que nous faisons des informations que vous nous confiez en présentant votre livre, et comment en garder le contrôle.",
        sections: [
          {
            heading: "Qui est responsable de vos données",
            body: [
              "Fine Bindery est un service édité par {{name}}, responsable du traitement décrit ici. Son identité complète figure dans les {{notice}}.",
              "Pour toute question ou demande : {{mail}}.",
            ],
          },
          {
            heading: "Les informations que vous nous donnez",
            body: [
              "Lorsque vous présentez votre livre : ce que vous décrivez du livre et du projet — titre, auteur, nature, dimensions, état, travaux souhaités, valeur et budget indicatifs, délai —, les photographies que vous ajoutez et vos coordonnées : nom, adresse e-mail, téléphone, code postal et ville.",
              "Si vous créez un compte client : votre adresse e-mail et les informations nécessaires à la connexion.",
            ],
          },
          {
            heading: "Données techniques",
            body: [
              "Pour limiter les abus, votre adresse IP est transformée en empreinte non réversible avant d’être enregistrée. Nous ne conservons pas l’adresse IP elle-même.",
              "Pour mesurer la fréquentation, chaque page visitée est enregistrée anonymement : la page, le site référent, la langue, le type d’appareil et une empreinte renouvelée chaque jour. Cette mesure n’utilise pas de cookies.",
            ],
          },
          {
            heading: "Pourquoi nous les utilisons",
            body: [
              "Pour étudier votre projet, le chiffrer, choisir l’atelier dont les compétences lui correspondent, vous répondre et suivre les travaux ; vous envoyer le récapitulatif de votre projet ; protéger le service contre les abus ; comprendre, de manière agrégée, l’utilisation du site.",
            ],
          },
          {
            heading: "Sur quelle base",
            body: [
              "Votre consentement, recueilli avant l’envoi de votre projet, et les échanges précontractuels réalisés à votre demande. Vous pouvez retirer votre consentement à tout moment, sans effet sur ce qui a été fait avant ce retrait.",
            ],
          },
          {
            heading: "Qui y a accès",
            body: [
              "L’équipe Fine Bindery. Les ateliers partenaires consultés pour évaluer les travaux reçoivent la description du projet et ses photographies, sans vos coordonnées. Seul l’atelier retenu pour réaliser votre projet reçoit vos coordonnées.",
              "Vos données ne sont ni vendues ni louées. Les photographies de votre livre ne sont jamais publiées.",
            ],
          },
          {
            heading: "Nos prestataires",
            body: [
              "L’application est hébergée par {{webHost}}. La base de données et les photographies sont hébergées par {{dataHost}}, dans une région de l’{{region}}.",
              "Les e-mails, dont le récapitulatif de votre projet, sont envoyés par le service de messagerie de {{emailProvider}}, depuis une adresse du domaine {{senderDomain}}.",
              "Lorsque vous ajoutez une photographie d’inspiration, elle est analysée par un modèle d’intelligence artificielle via {{ai}} ; certaines analyses internes d’un projet y font aussi appel. L’intelligence artificielle ne fixe jamais le prix d’un projet.",
              "Certains de ces prestataires sont établis hors de l’Union européenne. Une liste détaillée des sous-traitants et des garanties encadrant les éventuels transferts sera publiée sur cette page.",
            ],
          },
          {
            heading: "Combien de temps nous les conservons",
            body: [
              "Le lien vers le récapitulatif de votre projet reste valable {{days}} jours.",
              "Les informations de votre projet sont conservées le temps de son étude et de son suivi. Les durées définitives de conservation sont encore en cours de définition et seront indiquées ici. Vous pouvez demander l’effacement de vos données à tout moment.",
            ],
          },
          {
            heading: "Ce que le site conserve dans votre navigateur",
            body: [
              "Un identifiant de session, pour reprendre un projet interrompu — « Présenter un autre projet » l’efface ; un identifiant de visite, effacé à la fermeture de l’onglet, pour la mesure de fréquentation ; et, si vous avez un compte, vos informations de connexion.",
              "Aucun cookie publicitaire ou de mesure d’audience tiers n’est utilisé.",
            ],
          },
          {
            heading: "Vos droits",
            body: [
              "Vous pouvez accéder à vos données, les rectifier, les faire effacer, limiter leur traitement, vous y opposer, en recevoir une copie dans un format réutilisable, retirer votre consentement et définir des directives sur leur sort après votre décès.",
              "Écrivez-nous à {{mail}}. Selon votre pays de résidence, vous pouvez aussi avoir le droit d’introduire une réclamation auprès de votre autorité locale de protection des données — en France, la CNIL, {{cnil}}.",
            ],
          },
        ],
      },
      "terms-of-use": {
        title: "Conditions d’utilisation",
        description:
          "Ce que vous pouvez attendre du site et ce à quoi il ne vous engage pas encore.",
        sections: [
          {
            heading: "Objet",
            body: [
              "Ces conditions régissent l’accès au site Fine Bindery et l’utilisation de son service de présentation de projet. Le site est édité par {{name}}.",
            ],
          },
          {
            heading: "Le service",
            body: [
              "Vous pouvez présenter un livre et décrire un projet — réparation, restauration, reliure, embellissement, transformation ou protection — gratuitement et sans engagement. Fine Bindery étudie les travaux nécessaires, peut vous proposer un prix et confie le projet à un atelier artisanal indépendant en France dont les compétences lui correspondent.",
            ],
          },
          {
            heading: "Aucun engagement à ce stade",
            body: [
              "L’envoi d’un projet ne constitue ni une commande ni une acceptation. Un prix ne devient ferme qu’une fois confirmé par Fine Bindery pour votre projet.",
              "La commande, le paiement et l’expédition de votre livre sont régis par les {{sales}}.",
            ],
          },
          {
            heading: "Vos informations et photographies",
            body: [
              "Vous vous engagez à fournir des informations exactes et garantissez détenir les droits sur les photographies que vous envoyez. Ces photographies servent uniquement à étudier et suivre votre projet ; elles ne sont jamais publiées.",
            ],
          },
          {
            heading: "Utilisation du site",
            body: [
              "Le site ne doit pas être utilisé de manière abusive : envois automatisés, contenus illicites, tentatives d’accès aux données d’autrui ou de perturbation du service.",
            ],
          },
          {
            heading: "Propriété intellectuelle",
            body: [
              "Les textes, le nom Fine Bindery et la présentation du site appartiennent à {{name}}. Les photographies de réalisations appartiennent à l’Atelier Reliure Dorure Ferrière, à Orléans, France, et sont reproduites avec son autorisation. Toute reproduction sans accord préalable est interdite.",
            ],
          },
          {
            heading: "Disponibilité",
            body: [
              "Nous faisons de notre mieux pour maintenir le site accessible, mais ne pouvons garantir un fonctionnement ininterrompu ou sans erreur.",
            ],
          },
          {
            heading: "Données personnelles",
            body: ["Le traitement de vos données est décrit dans la {{privacy}}."],
          },
          {
            heading: "Modifications et droit applicable",
            body: [
              "Ces conditions peuvent évoluer ; la version applicable est celle publiée sur cette page. Elles sont régies par le droit français, sous réserve des dispositions plus protectrices dont vous bénéficiez en tant que consommateur au titre du droit de votre pays.",
              "Pour toute question : {{mail}}.",
            ],
          },
        ],
      },
      "terms-of-sale": {
        title: "Conditions générales de vente",
        description:
          "Ce qui régit votre commande à partir du moment où un prix est confirmé pour votre projet.",
        sections: [
          {
            heading: "Objet et champ d’application",
            body: [
              "Ces conditions générales de vente régissent la commande auprès de Fine Bindery d’une prestation de reliure, réparation, restauration, embellissement, transformation ou protection d’un livre, une fois un prix confirmé pour votre projet. Elles complètent, sans les remplacer, les conditions d’utilisation et sont régies par le droit français.",
            ],
          },
          {
            heading: "Les parties au contrat",
            body: [
              "Votre contrat de vente est conclu avec {{name}} (« Fine Bindery »), qui vend la prestation et reste votre interlocuteur pour la commande, le paiement, le suivi et le service après-vente.",
              "Fine Bindery choisit l’atelier artisanal qui intervient sur votre livre : vous ne le choisissez pas lors de la commande et l’atelier retenu est indiqué dans votre espace client. C’est un partenaire d’exécution indépendant, choisi pour ses compétences. Il n’est pas partie à votre contrat de vente : vous ne le payez pas directement et Fine Bindery reste responsable envers vous de la bonne exécution de la prestation vendue.",
            ],
          },
          {
            heading: "Prix",
            body: [
              "Le prix proposé pour votre projet devient définitif lorsque vous le confirmez ; il correspond au prix indiqué dans votre espace client au moment de la commande, toutes taxes comprises.",
              "Le prix n’est dû qu’une fois votre commande passée selon les modalités ci-dessous ; le paiement s’effectue par carte auprès de notre prestataire de paiement, Stripe.",
            ],
          },
          {
            heading: "Commande, acceptation du devis et formation du contrat",
            body: [
              "Le devis que Fine Bindery vous adresse est émis sous la marque Fine Bindery ; il précise la prestation, le prix TTC et le délai annoncé. Vous l’acceptez expressément en cochant l’acceptation du devis et des présentes conditions avant de payer. Cette acceptation est enregistrée avec la version des conditions affichée.",
              "Le contrat de vente est formé lorsque vous avez accepté le devis et effectué le paiement de votre commande. Vous recevez une confirmation de commande par e-mail.",
            ],
          },
          {
            heading: "Facturation",
            body: [
              "La facture de votre commande est émise par {{name}} sous la marque Fine Bindery, à l’adresse de facturation fournie lors de l’acceptation du devis. Elle est disponible dans votre espace client. En cas de remboursement, un avoir est émis.",
              "L’atelier qui réalise les travaux ne vous facture pas : il facture {{name}}.",
            ],
          },
          {
            heading: "Droit de rétractation",
            body: [
              "Si vous achetez en tant que consommateur au sein de l’Union européenne, vous disposez généralement d’un droit de rétractation de 14 jours pour une vente à distance, sans avoir à donner de motif.",
              "{{review}} En particulier : les conditions exactes d’exercice de ce droit, une éventuelle exception pour une prestation personnalisée sur votre livre, le modèle de rétractation et les règles applicables à un client achetant hors de l’UE restent à rédiger avec un juriste avant l’ouverture de toute vente réelle.",
            ],
          },
          {
            heading: "Exécution de la prestation",
            body: [
              "Fine Bindery organise la collecte et le retour de votre livre une fois la prestation terminée, selon les modalités décrites dans votre espace client. Tout retard vous est communiqué dès qu’il est connu.",
            ],
          },
          {
            heading: "Transport aller-retour (option)",
            body: [
              "Pour un livre courant d’une valeur déclarée inférieure à 100 €, emballé dans un colis de 500 g maximum et de 35 × 25 × 8 cm, entre deux adresses de France métropolitaine (hors Corse), votre proposition peut inclure une ligne séparée « Transport aller-retour » de 15 € TTC. Elle couvre l’étiquette aller, que nous vous remettons, et l’étiquette retour, que nous remettons à l’atelier. Sinon, le transport fait l’objet d’un devis distinct, ou vous l’organisez vous-même ou remettez le livre en main propre.",
              "Ce forfait ne comprend aucune assurance. En cas de perte ou de dommage, seule l’indemnisation propre au transporteur peut s’appliquer : pour Mondial Relay, au maximum 25 € par colis, frais de port compris, sur justificatif de valeur. Pour un livre confié pour travaux, aucune indemnisation n’est garantie. Les livres anciens, rares, uniques ou de valeur supérieure ne voyagent pas sous ce forfait.",
              "Un scan de livraison du transporteur ne vaut pas réception : l’atelier confirme lui-même la réception physique et l’état du livre, avec des photographies. En cas de problème, nous déposons la réclamation auprès du transporteur dans ses délais (dommages : 3 jours ouvrés après livraison ; perte : 30 jours) et vous tenons informé dans votre espace client.",
            ],
          },
          {
            heading: "Garanties",
            body: [
              "{{review}} Les garanties légales de conformité et des vices cachés applicables en droit français, ainsi que leur articulation avec les garanties dont un client peut bénéficier séparément au titre du droit de son pays, restent à rédiger avec un juriste avant l’ouverture de toute vente réelle.",
            ],
          },
          {
            heading: "Responsabilité",
            body: [
              "{{review}} L’étendue et les limites de la responsabilité de Fine Bindery, notamment pour un livre ancien ou de valeur, restent à définir avec un juriste avant l’ouverture de toute vente réelle.",
            ],
          },
          { heading: "Médiation de la consommation", body: ["{{mediator}}"] },
          {
            heading: "Données personnelles",
            body: ["Le traitement de vos données est décrit dans la {{privacy}}."],
          },
          {
            heading: "Droit applicable et litiges",
            body: [
              "Ces conditions sont régies par le droit français, sous réserve des dispositions plus protectrices dont vous bénéficiez en tant que consommateur au titre du droit de votre pays.",
              "Pour toute question : {{mail}}.",
            ],
          },
        ],
      },
    },
  },
  de: {
    eyebrow: "Rechtliche Informationen",
    updated: "Zuletzt aktualisiert:",
    seeAlso: "Siehe auch:",
    other: "Weitere rechtliche Informationen",
    pages: {
      "legal-notice": {
        title: "Impressum",
        description: "Wer Fine Bindery herausgibt und wo die Website gehostet wird.",
        sections: [
          {
            heading: "Herausgeber",
            body: [
              "Fine Bindery ist ein Dienst von {{name}}, einer französischen Gesellschaft der Rechtsform {{form}} mit einem Stammkapital von {{capital}}.",
              "Sitz: {{address}}, Frankreich.",
              "SIREN: {{siren}} — SIRET (Hauptsitz): {{siret}}. {{rcs}}. Umsatzsteuer-Identifikationsnummer: {{vat}}.",
              "Kontakt: {{mail}}.",
            ],
          },
          {
            heading: "Verantwortlicher für die Veröffentlichung",
            body: ["Der gesetzliche Vertreter von {{name}}."],
          },
          {
            heading: "Hosting",
            body: [
              "Website: {{webHost}}, {{webAddress}}.",
              "Daten und Fotografien: {{dataHost}}, Region {{region}}.",
            ],
          },
          {
            heading: "Bildnachweise",
            body: ["Atelier Reliure Dorure Ferrière, Orléans, Frankreich."],
          },
        ],
      },
      "privacy-policy": {
        title: "Datenschutzerklärung",
        description:
          "Wie wir die Angaben verwenden, die Sie uns bei der Vorstellung Ihres Buches geben, und wie Sie die Kontrolle darüber behalten.",
        sections: [
          {
            heading: "Wer für Ihre Daten verantwortlich ist",
            body: [
              "Fine Bindery ist ein Dienst von {{name}}, dem hier beschriebenen Verantwortlichen für die Datenverarbeitung. Die vollständigen Angaben finden Sie im {{notice}}.",
              "Bei Fragen oder Anliegen: {{mail}}.",
            ],
          },
          {
            heading: "Die Angaben, die Sie uns geben",
            body: [
              "Wenn Sie Ihr Buch vorstellen: Ihre Angaben zum Buch und zum Projekt — Titel, Autor, Art, Maße, Zustand, gewünschte Arbeiten, ungefährer Wert und Budget, Zeitrahmen —, die hinzugefügten Fotografien und Ihre Kontaktdaten: Name, E-Mail-Adresse, Telefonnummer, Postleitzahl und Ort.",
              "Wenn Sie ein Kundenkonto anlegen: Ihre E-Mail-Adresse und die für die Anmeldung erforderlichen Angaben.",
            ],
          },
          {
            heading: "Technische Daten",
            body: [
              "Zur Begrenzung von Missbrauch wird Ihre IP-Adresse vor der Speicherung in einen nicht umkehrbaren Fingerabdruck umgewandelt. Die IP-Adresse selbst speichern wir nicht.",
              "Zur Messung der Websitebesuche wird jede besuchte Seite anonym erfasst: die Seite, die verweisende Website, die Sprache, der Gerätetyp und ein täglich erneuerter Fingerabdruck. Diese Messung verwendet keine Cookies.",
            ],
          },
          {
            heading: "Wofür wir die Daten verwenden",
            body: [
              "Um Ihr Projekt zu prüfen, zu kalkulieren, die Werkstatt mit den passenden Fähigkeiten auszuwählen, Ihnen zu antworten und die Arbeiten zu begleiten; um Ihnen Ihre Projektzusammenfassung zu senden; um den Dienst vor Missbrauch zu schützen; um die Nutzung der Website in zusammengefasster Form zu verstehen.",
            ],
          },
          {
            heading: "Auf welcher Grundlage",
            body: [
              "Ihre Einwilligung, die vor dem Absenden Ihres Projekts eingeholt wird, sowie die auf Ihren Wunsch geführten vorvertraglichen Gespräche. Sie können Ihre Einwilligung jederzeit widerrufen; dies berührt nicht die vor dem Widerruf erfolgte Verarbeitung.",
            ],
          },
          {
            heading: "Wer Zugriff hat",
            body: [
              "Das Team von Fine Bindery. Partnerwerkstätten, die zur Beurteilung der Arbeiten hinzugezogen werden, erhalten die Projektbeschreibung und die Fotografien ohne Ihre Kontaktdaten. Nur die für Ihr Projekt ausgewählte Werkstatt erhält Ihre Kontaktdaten.",
              "Ihre Daten werden weder verkauft noch vermietet. Fotografien Ihres Buches werden niemals veröffentlicht.",
            ],
          },
          {
            heading: "Unsere Dienstleister",
            body: [
              "Die Anwendung wird von {{webHost}} gehostet. Die Datenbank und die Fotografien werden von {{dataHost}} in der Region {{region}} gehostet.",
              "E-Mails, einschließlich Ihrer Projektzusammenfassung, werden über den E-Mail-Dienst von {{emailProvider}} von einer Adresse der Domain {{senderDomain}} versandt.",
              "Wenn Sie ein Inspirationsfoto hinzufügen, wird es über {{ai}} von einem Modell künstlicher Intelligenz analysiert; auch einige interne Projektprüfungen nutzen dies. Künstliche Intelligenz legt niemals den Preis eines Projekts fest.",
              "Einige dieser Dienstleister haben ihren Sitz außerhalb der Europäischen Union. Eine detaillierte Liste der Unterauftragsverarbeiter und der Garantien für etwaige Übermittlungen wird auf dieser Seite veröffentlicht.",
            ],
          },
          {
            heading: "Wie lange wir die Daten aufbewahren",
            body: [
              "Der Link zu Ihrer Projektzusammenfassung bleibt {{days}} Tage gültig.",
              "Ihre Projektangaben werden für die Dauer der Prüfung und Begleitung aufbewahrt. Die endgültigen Aufbewahrungsfristen werden noch festgelegt und hier angegeben. Sie können jederzeit die Löschung Ihrer Daten verlangen.",
            ],
          },
          {
            heading: "Was die Website in Ihrem Browser speichert",
            body: [
              "Eine Sitzungskennung, damit Sie ein unterbrochenes Projekt fortsetzen können — „Ein weiteres Projekt vorstellen“ löscht sie; eine Besuchskennung zur Besuchsmessung, die beim Schließen des Tabs gelöscht wird; und, falls Sie ein Konto haben, Ihre Anmeldeinformationen.",
              "Es werden keine Werbe-Cookies oder Cookies zur Reichweitenmessung durch Dritte verwendet.",
            ],
          },
          {
            heading: "Ihre Rechte",
            body: [
              "Sie können auf Ihre Daten zugreifen, sie berichtigen oder löschen lassen, ihre Verarbeitung einschränken, ihr widersprechen, eine Kopie in einem wiederverwendbaren Format erhalten, Ihre Einwilligung widerrufen und Anweisungen zu ihrem Verbleib nach Ihrem Tod festlegen.",
              "Schreiben Sie an {{mail}}. Je nach Ihrem Wohnsitzland können Sie außerdem das Recht haben, Beschwerde bei Ihrer örtlichen Datenschutzbehörde einzulegen — in Frankreich bei der CNIL, {{cnil}}.",
            ],
          },
        ],
      },
      "terms-of-use": {
        title: "Nutzungsbedingungen",
        description:
          "Was Sie von der Website erwarten können und welche Verpflichtungen in dieser Phase noch nicht entstehen.",
        sections: [
          {
            heading: "Zweck",
            body: [
              "Diese Bedingungen regeln den Zugang zur Website Fine Bindery und die Nutzung ihres Dienstes zur Projektvorstellung. Die Website wird von {{name}} herausgegeben.",
            ],
          },
          {
            heading: "Der Dienst",
            body: [
              "Sie können kostenlos und unverbindlich ein Buch vorstellen und ein Projekt beschreiben — Reparatur, Restaurierung, Einband, Veredelung, Umgestaltung oder Schutz. Fine Bindery prüft die erforderlichen Arbeiten, kann Ihnen einen Preis anbieten und überträgt das Projekt einer unabhängigen Handwerkswerkstatt in Frankreich mit den passenden Fähigkeiten.",
            ],
          },
          {
            heading: "In dieser Phase keine Verpflichtung",
            body: [
              "Das Absenden eines Projekts ist weder eine Bestellung noch eine Annahme. Ein Preis wird erst verbindlich, wenn Fine Bindery ihn für Ihr Projekt bestätigt hat.",
              "Bestellung, Zahlung und Versand Ihres Buches unterliegen den {{sales}}.",
            ],
          },
          {
            heading: "Ihre Angaben und Fotografien",
            body: [
              "Sie verpflichten sich zu richtigen Angaben und sichern zu, die Rechte an den eingereichten Fotografien zu besitzen. Diese Fotografien werden ausschließlich zur Prüfung und Begleitung Ihres Projekts verwendet; sie werden niemals veröffentlicht.",
            ],
          },
          {
            heading: "Nutzung der Website",
            body: [
              "Die Website darf nicht missbräuchlich genutzt werden: automatisierte Einsendungen, rechtswidrige Inhalte, Versuche, auf fremde Daten zuzugreifen oder den Dienst zu stören.",
            ],
          },
          {
            heading: "Geistiges Eigentum",
            body: [
              "Die Texte, der Name Fine Bindery und die Gestaltung der Website gehören {{name}}. Fotografien fertiger Arbeiten gehören dem Atelier Reliure Dorure Ferrière in Orléans, Frankreich, und werden mit dessen Genehmigung wiedergegeben. Jede Vervielfältigung ohne vorherige Zustimmung ist untersagt.",
            ],
          },
          {
            heading: "Verfügbarkeit",
            body: [
              "Wir bemühen uns, die Website zugänglich zu halten, können aber keinen ununterbrochenen oder fehlerfreien Betrieb garantieren.",
            ],
          },
          {
            heading: "Personenbezogene Daten",
            body: ["Die Verarbeitung Ihrer Daten wird in der {{privacy}} beschrieben."],
          },
          {
            heading: "Änderungen und anwendbares Recht",
            body: [
              "Diese Bedingungen können sich ändern; maßgeblich ist die auf dieser Seite veröffentlichte Fassung. Es gilt französisches Recht, vorbehaltlich günstigerer Bestimmungen, die Ihnen als Verbraucher nach dem Recht Ihres eigenen Landes zustehen.",
              "Bei Fragen: {{mail}}.",
            ],
          },
        ],
      },
      "terms-of-sale": {
        title: "Verkaufsbedingungen",
        description:
          "Die Bedingungen Ihrer Bestellung, sobald ein Preis für Ihr Projekt bestätigt wurde.",
        sections: [
          {
            heading: "Zweck und Geltungsbereich",
            body: [
              "Diese Verkaufsbedingungen regeln die Bestellung einer Leistung zur Buchbinderei, Reparatur, Restaurierung, Veredelung, Umgestaltung oder zum Schutz eines Buches bei Fine Bindery, sobald ein Preis für Ihr Projekt bestätigt wurde. Sie ergänzen die Nutzungsbedingungen, ohne sie zu ersetzen, und unterliegen französischem Recht.",
            ],
          },
          {
            heading: "Vertragsparteien",
            body: [
              "Ihr Kaufvertrag kommt mit {{name}} („Fine Bindery“) zustande. Diese verkauft die Leistung und bleibt Ihr Ansprechpartner für Bestellung, Zahlung, Begleitung und Kundendienst.",
              "Fine Bindery wählt die Handwerkswerkstatt aus, die an Ihrem Buch arbeitet: Sie wählen sie nicht bei der Bestellung aus; die ausgewählte Werkstatt wird in Ihrem Kundenbereich angezeigt. Sie ist ein unabhängiger, nach ihren Fähigkeiten ausgewählter Ausführungspartner. Sie ist keine Partei Ihres Kaufvertrags: Sie bezahlen sie nicht direkt, und Fine Bindery bleibt Ihnen gegenüber für die ordnungsgemäße Ausführung der verkauften Leistung verantwortlich.",
            ],
          },
          {
            heading: "Preis",
            body: [
              "Der für Ihr Projekt angebotene Preis wird endgültig, sobald Sie ihn bestätigen; er entspricht dem bei der Bestellung in Ihrem Kundenbereich angezeigten Preis einschließlich aller Steuern.",
              "Der Preis wird erst nach der unten beschriebenen Bestellung fällig; die Zahlung erfolgt per Karte über unseren Zahlungsdienstleister Stripe.",
            ],
          },
          {
            heading: "Bestellung, Angebotsannahme und Vertragsschluss",
            body: [
              "Das Angebot von Fine Bindery wird unter der Marke Fine Bindery ausgestellt; es nennt die Leistung, den Preis einschließlich Steuern und die angekündigte Bearbeitungszeit. Sie nehmen es ausdrücklich an, indem Sie vor der Zahlung die Annahme des Angebots und dieser Bedingungen bestätigen. Diese Annahme wird zusammen mit der angezeigten Fassung der Bedingungen gespeichert.",
              "Der Kaufvertrag kommt zustande, sobald Sie das Angebot angenommen und Ihre Bestellung bezahlt haben. Sie erhalten eine Bestellbestätigung per E-Mail.",
            ],
          },
          {
            heading: "Rechnungsstellung",
            body: [
              "Die Rechnung für Ihre Bestellung wird von {{name}} unter der Marke Fine Bindery an die bei der Angebotsannahme angegebene Rechnungsadresse ausgestellt. Sie steht in Ihrem Kundenbereich zur Verfügung. Bei einer Erstattung wird eine Gutschrift ausgestellt.",
              "Die ausführende Werkstatt stellt Ihnen keine Rechnung: Sie stellt {{name}} ihre Rechnung.",
            ],
          },
          {
            heading: "Widerrufsrecht",
            body: [
              "Wenn Sie als Verbraucher innerhalb der Europäischen Union kaufen, haben Sie bei einem Fernabsatzgeschäft in der Regel ein 14-tägiges Widerrufsrecht ohne Angabe von Gründen.",
              "{{review}} Insbesondere die genauen Bedingungen zur Ausübung dieses Rechts, eine mögliche Ausnahme für eine auf Ihr Buch zugeschnittene Leistung, das Muster-Widerrufsformular und die Regeln für Kunden außerhalb der EU müssen vor Beginn tatsächlicher Verkäufe noch mit einem Juristen ausgearbeitet werden.",
            ],
          },
          {
            heading: "Ausführung der Leistung",
            body: [
              "Fine Bindery organisiert die Abholung und die Rücksendung Ihres Buches nach Abschluss der Leistung gemäß der Beschreibung in Ihrem Kundenbereich. Jede Verzögerung wird Ihnen mitgeteilt, sobald sie bekannt ist.",
            ],
          },
          {
            heading: "Hin- und Rückversand (Option)",
            body: [
              "Für ein gewöhnliches Buch mit einem deklarierten Wert unter 100 €, verpackt in einem Paket von höchstens 500 g und 35 × 25 × 8 cm, zwischen zwei Adressen im französischen Mutterland (ohne Korsika), kann Ihr Angebot eine gesonderte Position „Hin- und Rückversand“ von 15 € inkl. MwSt. enthalten. Sie umfasst das Versandetikett für den Hinweg, das Sie erhalten, und das Rückversandetikett für die Werkstatt. Andernfalls wird der Versand gesondert angeboten, oder Sie organisieren ihn selbst beziehungsweise übergeben das Buch persönlich.",
              "Diese Pauschale enthält keine Versicherung. Bei Verlust oder Beschädigung kommt nur eine Entschädigung des Transporteurs selbst in Betracht: bei Mondial Relay höchstens 25 € pro Paket einschließlich Porto gegen Wertnachweis. Für ein zur Bearbeitung anvertrautes Buch wird keine Entschädigung garantiert. Antiquarische, seltene, einzigartige oder wertvollere Bücher werden nicht unter dieser Pauschale versandt.",
              "Ein Zustellscan des Transporteurs gilt nicht als Empfang: Die Werkstatt bestätigt selbst den physischen Empfang und den Zustand des Buches mit Fotografien. Bei Problemen melden wir den Anspruch innerhalb der Fristen des Transporteurs an (Beschädigung: 3 Werktage nach Zustellung; Verlust: 30 Tage) und halten Sie in Ihrem Kundenbereich auf dem Laufenden.",
            ],
          },
          {
            heading: "Gewährleistung",
            body: [
              "{{review}} Die nach französischem Recht geltenden gesetzlichen Gewährleistungen für Vertragsmäßigkeit und verborgene Mängel sowie ihr Verhältnis zu zusätzlichen Gewährleistungen nach dem Recht des Landes des Kunden müssen vor Beginn tatsächlicher Verkäufe noch mit einem Juristen ausgearbeitet werden.",
            ],
          },
          {
            heading: "Haftung",
            body: [
              "{{review}} Umfang und Grenzen der Haftung von Fine Bindery, insbesondere für ein altes oder wertvolles Buch, müssen vor Beginn tatsächlicher Verkäufe noch mit einem Juristen festgelegt werden.",
            ],
          },
          { heading: "Verbraucherschlichtung", body: ["{{mediator}}"] },
          {
            heading: "Personenbezogene Daten",
            body: ["Die Verarbeitung Ihrer Daten wird in der {{privacy}} beschrieben."],
          },
          {
            heading: "Anwendbares Recht und Streitigkeiten",
            body: [
              "Diese Bedingungen unterliegen französischem Recht, vorbehaltlich günstigerer Bestimmungen, die Ihnen als Verbraucher nach dem Recht Ihres eigenen Landes zustehen.",
              "Bei Fragen: {{mail}}.",
            ],
          },
        ],
      },
    },
  },
  it: {
    eyebrow: "Informazioni legali",
    updated: "Ultimo aggiornamento:",
    seeAlso: "Vedi anche:",
    other: "Altre informazioni legali",
    pages: {
      "legal-notice": {
        title: "Note legali",
        description: "Chi pubblica Fine Bindery e dove è ospitato il sito.",
        sections: [
          {
            heading: "Editore",
            body: [
              "Fine Bindery è un servizio pubblicato da {{name}}, società francese di forma giuridica {{form}} con capitale sociale di {{capital}}.",
              "Sede legale: {{address}}, Francia.",
              "SIREN: {{siren}} — SIRET (sede principale): {{siret}}. {{rcs}}. Partita IVA intracomunitaria: {{vat}}.",
              "Contatto: {{mail}}.",
            ],
          },
          {
            heading: "Direttore della pubblicazione",
            body: ["Il rappresentante legale di {{name}}."],
          },
          {
            heading: "Hosting",
            body: [
              "Sito: {{webHost}}, {{webAddress}}.",
              "Dati e fotografie: {{dataHost}}, regione {{region}}.",
            ],
          },
          {
            heading: "Crediti fotografici",
            body: ["Atelier Reliure Dorure Ferrière, Orléans, Francia."],
          },
        ],
      },
      "privacy-policy": {
        title: "Informativa sulla privacy",
        description:
          "Come trattiamo le informazioni che ci affidate presentando il vostro libro e come mantenerne il controllo.",
        sections: [
          {
            heading: "Chi è responsabile dei vostri dati",
            body: [
              "Fine Bindery è un servizio pubblicato da {{name}}, titolare del trattamento descritto qui. I dati identificativi completi sono riportati nelle {{notice}}.",
              "Per qualsiasi domanda o richiesta: {{mail}}.",
            ],
          },
          {
            heading: "Le informazioni che ci fornite",
            body: [
              "Quando presentate il vostro libro: ciò che descrivete del libro e del progetto — titolo, autore, natura, dimensioni, stato, lavori richiesti, valore e budget indicativi, tempistiche —, le fotografie aggiunte e i vostri recapiti: nome, indirizzo e-mail, telefono, codice postale e città.",
              "Se create un account cliente: il vostro indirizzo e-mail e le informazioni necessarie per accedere.",
            ],
          },
          {
            heading: "Dati tecnici",
            body: [
              "Per limitare gli abusi, il vostro indirizzo IP viene trasformato in un’impronta non reversibile prima di essere registrato. Non conserviamo l’indirizzo IP stesso.",
              "Per misurare il traffico, ogni pagina visitata viene registrata in forma anonima: la pagina, il sito di provenienza, la lingua, il tipo di dispositivo e un’impronta rinnovata ogni giorno. Questa misurazione non utilizza cookie.",
            ],
          },
          {
            heading: "Perché li utilizziamo",
            body: [
              "Per esaminare il vostro progetto, determinarne il prezzo, scegliere il laboratorio con le competenze adatte, rispondervi e seguire i lavori; per inviarvi il riepilogo del progetto; per proteggere il servizio dagli abusi; per comprendere, in forma aggregata, come viene utilizzato il sito.",
            ],
          },
          {
            heading: "Su quale base",
            body: [
              "Il vostro consenso, raccolto prima dell’invio del progetto, e gli scambi precontrattuali effettuati su vostra richiesta. Potete revocare il consenso in qualsiasi momento, senza effetti su quanto svolto prima della revoca.",
            ],
          },
          {
            heading: "Chi può accedervi",
            body: [
              "Il team Fine Bindery. I laboratori partner consultati per valutare i lavori ricevono la descrizione del progetto e le fotografie, senza i vostri recapiti. Solo il laboratorio selezionato per realizzare il progetto riceve i vostri recapiti.",
              "I vostri dati non vengono venduti né affittati. Le fotografie del vostro libro non vengono mai pubblicate.",
            ],
          },
          {
            heading: "I nostri fornitori",
            body: [
              "L’applicazione è ospitata da {{webHost}}. Il database e le fotografie sono ospitati da {{dataHost}}, nella regione {{region}}.",
              "Le e-mail, compreso il riepilogo del progetto, vengono inviate tramite il servizio di posta elettronica di {{emailProvider}}, da un indirizzo sul dominio {{senderDomain}}.",
              "Quando aggiungete una fotografia d’ispirazione, questa viene analizzata da un modello di intelligenza artificiale tramite {{ai}}; anche alcune analisi interne dei progetti lo utilizzano. L’intelligenza artificiale non stabilisce mai il prezzo di un progetto.",
              "Alcuni di questi fornitori hanno sede fuori dall’Unione europea. Un elenco dettagliato dei sub-responsabili e delle garanzie che disciplinano gli eventuali trasferimenti verrà pubblicato su questa pagina.",
            ],
          },
          {
            heading: "Per quanto tempo li conserviamo",
            body: [
              "Il link al riepilogo del progetto resta valido per {{days}} giorni.",
              "Le informazioni sul progetto sono conservate per il tempo necessario al suo esame e al suo seguito. I periodi definitivi di conservazione sono ancora in fase di definizione e saranno indicati qui. Potete richiedere la cancellazione dei dati in qualsiasi momento.",
            ],
          },
          {
            heading: "Cosa conserva il sito nel vostro browser",
            body: [
              "Un identificativo di sessione, per riprendere un progetto interrotto — «Presentare un altro progetto» lo cancella; un identificativo di visita per la misurazione del traffico, cancellato alla chiusura della scheda; e, se avete un account, le vostre informazioni di accesso.",
              "Non vengono utilizzati cookie pubblicitari o di misurazione del pubblico di terzi.",
            ],
          },
          {
            heading: "I vostri diritti",
            body: [
              "Potete accedere ai vostri dati, correggerli, farli cancellare, limitarne il trattamento, opporvi, riceverne una copia in un formato riutilizzabile, revocare il consenso e stabilire direttive sulla loro sorte dopo la vostra morte.",
              "Scriveteci a {{mail}}. A seconda del paese di residenza, potreste anche avere il diritto di presentare un reclamo all’autorità locale per la protezione dei dati — in Francia, la CNIL, {{cnil}}.",
            ],
          },
        ],
      },
      "terms-of-use": {
        title: "Condizioni d’uso",
        description: "Cosa potete aspettarvi dal sito e quali impegni non comporta ancora.",
        sections: [
          {
            heading: "Oggetto",
            body: [
              "Queste condizioni disciplinano l’accesso al sito Fine Bindery e l’utilizzo del suo servizio di presentazione dei progetti. Il sito è pubblicato da {{name}}.",
            ],
          },
          {
            heading: "Il servizio",
            body: [
              "Potete presentare un libro e descrivere un progetto — riparazione, restauro, legatura, abbellimento, trasformazione o protezione — gratuitamente e senza impegno. Fine Bindery esamina i lavori necessari, può proporvi un prezzo e affida il progetto a un laboratorio artigiano indipendente in Francia con le competenze adatte.",
            ],
          },
          {
            heading: "Nessun impegno in questa fase",
            body: [
              "L’invio di un progetto non costituisce né un ordine né un’accettazione. Un prezzo diventa vincolante solo dopo la conferma di Fine Bindery per il vostro progetto.",
              "L’ordine, il pagamento e la spedizione del vostro libro sono disciplinati dalle {{sales}}.",
            ],
          },
          {
            heading: "Le vostre informazioni e fotografie",
            body: [
              "Vi impegnate a fornire informazioni esatte e garantite di detenere i diritti sulle fotografie inviate. Queste fotografie vengono utilizzate esclusivamente per esaminare e seguire il progetto; non vengono mai pubblicate.",
            ],
          },
          {
            heading: "Utilizzo del sito",
            body: [
              "Il sito non deve essere utilizzato in modo abusivo: invii automatizzati, contenuti illeciti, tentativi di accedere ai dati altrui o di perturbare il servizio.",
            ],
          },
          {
            heading: "Proprietà intellettuale",
            body: [
              "I testi, il nome Fine Bindery e la presentazione del sito appartengono a {{name}}. Le fotografie dei lavori finiti appartengono all’Atelier Reliure Dorure Ferrière di Orléans, Francia, e sono riprodotte con la sua autorizzazione. Qualsiasi riproduzione senza previo accordo è vietata.",
            ],
          },
          {
            heading: "Disponibilità",
            body: [
              "Facciamo del nostro meglio per mantenere il sito accessibile, ma non possiamo garantire un funzionamento ininterrotto o privo di errori.",
            ],
          },
          {
            heading: "Dati personali",
            body: ["Il trattamento dei vostri dati è descritto nell’{{privacy}}."],
          },
          {
            heading: "Modifiche e legge applicabile",
            body: [
              "Queste condizioni possono cambiare; la versione applicabile è quella pubblicata su questa pagina. Sono disciplinate dal diritto francese, fatte salve le disposizioni più protettive di cui beneficiate come consumatori secondo il diritto del vostro paese.",
              "Per qualsiasi domanda: {{mail}}.",
            ],
          },
        ],
      },
      "terms-of-sale": {
        title: "Condizioni di vendita",
        description:
          "Le condizioni che disciplinano il vostro ordine dal momento in cui viene confermato un prezzo per il progetto.",
        sections: [
          {
            heading: "Oggetto e ambito di applicazione",
            body: [
              "Queste condizioni di vendita disciplinano l’ordine presso Fine Bindery di un servizio di legatoria, riparazione, restauro, abbellimento, trasformazione o protezione di un libro, una volta confermato un prezzo per il progetto. Integrano, senza sostituirle, le condizioni d’uso e sono disciplinate dal diritto francese.",
            ],
          },
          {
            heading: "Le parti del contratto",
            body: [
              "Il vostro contratto di vendita è concluso con {{name}} («Fine Bindery»), che vende il servizio e resta il vostro interlocutore per ordine, pagamento, seguito e assistenza post-vendita.",
              "Fine Bindery sceglie il laboratorio artigiano che lavora sul vostro libro: non lo scegliete al momento dell’ordine e il laboratorio selezionato è indicato nella vostra area cliente. È un partner esecutivo indipendente, scelto per le sue competenze. Non è parte del vostro contratto di vendita: non lo pagate direttamente e Fine Bindery resta responsabile nei vostri confronti della corretta esecuzione del servizio venduto.",
            ],
          },
          {
            heading: "Prezzo",
            body: [
              "Il prezzo proposto per il progetto diventa definitivo quando lo confermate; corrisponde al prezzo indicato nella vostra area cliente al momento dell’ordine, imposte incluse.",
              "Il prezzo è dovuto solo dopo l’inoltro dell’ordine secondo le modalità seguenti; il pagamento avviene con carta tramite il nostro fornitore di servizi di pagamento, Stripe.",
            ],
          },
          {
            heading: "Ordine, accettazione del preventivo e conclusione del contratto",
            body: [
              "Il preventivo inviato da Fine Bindery è emesso con il marchio Fine Bindery; indica il servizio, il prezzo imposte incluse e i tempi annunciati. Lo accettate espressamente selezionando l’accettazione del preventivo e di queste condizioni prima del pagamento. L’accettazione viene registrata insieme alla versione delle condizioni visualizzata.",
              "Il contratto di vendita è concluso quando avete accettato il preventivo ed effettuato il pagamento dell’ordine. Ricevete una conferma d’ordine via e-mail.",
            ],
          },
          {
            heading: "Fatturazione",
            body: [
              "La fattura dell’ordine è emessa da {{name}} con il marchio Fine Bindery, all’indirizzo di fatturazione fornito al momento dell’accettazione del preventivo. È disponibile nella vostra area cliente. In caso di rimborso viene emessa una nota di credito.",
              "Il laboratorio che esegue i lavori non vi fattura: fattura a {{name}}.",
            ],
          },
          {
            heading: "Diritto di recesso",
            body: [
              "Se acquistate come consumatori all’interno dell’Unione europea, generalmente disponete di un diritto di recesso di 14 giorni per una vendita a distanza senza dover fornire motivazioni.",
              "{{review}} In particolare: le condizioni esatte per esercitare questo diritto, un’eventuale eccezione per un servizio personalizzato sul vostro libro, il modulo tipo di recesso e le regole applicabili a chi acquista fuori dall’UE devono ancora essere redatti con un giurista prima dell’apertura di qualsiasi vendita reale.",
            ],
          },
          {
            heading: "Esecuzione del servizio",
            body: [
              "Fine Bindery organizza il ritiro e la restituzione del libro una volta completato il servizio, come descritto nella vostra area cliente. Ogni ritardo vi viene comunicato non appena noto.",
            ],
          },
          {
            heading: "Trasporto andata e ritorno (opzione)",
            body: [
              "Per un libro comune con valore dichiarato inferiore a 100 €, imballato in un pacco di massimo 500 g e 35 × 25 × 8 cm, tra due indirizzi della Francia metropolitana (esclusa la Corsica), la proposta può includere una voce separata «Trasporto andata e ritorno» di 15 € IVA inclusa. Copre l’etichetta di andata, che consegniamo a voi, e quella di ritorno, che consegniamo al laboratorio. Negli altri casi il trasporto viene preventivato separatamente, oppure lo organizzate voi o consegnate il libro di persona.",
              "Questa tariffa non include alcuna assicurazione. In caso di perdita o danno può applicarsi solo l’indennizzo del vettore: per Mondial Relay, massimo 25 € per pacco, spese di spedizione incluse, dietro prova del valore. Per un libro affidato per lavori non è garantito alcun indennizzo. I libri antichi, rari, unici o di maggior valore non viaggiano con questa tariffa.",
              "Una scansione di consegna del vettore non equivale a ricezione: il laboratorio conferma personalmente la ricezione fisica e lo stato del libro con fotografie. In caso di problemi presentiamo il reclamo al vettore entro i suoi termini (danni: 3 giorni lavorativi dopo la consegna; perdita: 30 giorni) e vi teniamo informati nella vostra area cliente.",
            ],
          },
          {
            heading: "Garanzie",
            body: [
              "{{review}} Le garanzie legali di conformità e per vizi occulti applicabili secondo il diritto francese e il loro rapporto con le garanzie spettanti al cliente secondo il diritto del proprio paese devono ancora essere redatti con un giurista prima dell’apertura di qualsiasi vendita reale.",
            ],
          },
          {
            heading: "Responsabilità",
            body: [
              "{{review}} L’ambito e i limiti della responsabilità di Fine Bindery, in particolare per un libro antico o di valore, devono ancora essere definiti con un giurista prima dell’apertura di qualsiasi vendita reale.",
            ],
          },
          { heading: "Mediazione dei consumatori", body: ["{{mediator}}"] },
          {
            heading: "Dati personali",
            body: ["Il trattamento dei vostri dati è descritto nell’{{privacy}}."],
          },
          {
            heading: "Legge applicabile e controversie",
            body: [
              "Queste condizioni sono disciplinate dal diritto francese, fatte salve le disposizioni più protettive di cui beneficiate come consumatori secondo il diritto del vostro paese.",
              "Per qualsiasi domanda: {{mail}}.",
            ],
          },
        ],
      },
    },
  },
  es: {
    eyebrow: "Información legal",
    updated: "Última actualización:",
    seeAlso: "Véase también:",
    other: "Otra información legal",
    pages: {
      "legal-notice": {
        title: "Aviso legal",
        description: "Quién publica Fine Bindery y dónde se aloja el sitio.",
        sections: [
          {
            heading: "Editor",
            body: [
              "Fine Bindery es un servicio publicado por {{name}}, sociedad francesa con forma jurídica {{form}} y un capital social de {{capital}}.",
              "Domicilio social: {{address}}, Francia.",
              "SIREN: {{siren}} — SIRET (sede principal): {{siret}}. {{rcs}}. Número de IVA intracomunitario: {{vat}}.",
              "Contacto: {{mail}}.",
            ],
          },
          { heading: "Director de la publicación", body: ["El representante legal de {{name}}."] },
          {
            heading: "Alojamiento",
            body: [
              "Sitio: {{webHost}}, {{webAddress}}.",
              "Datos y fotografías: {{dataHost}}, región {{region}}.",
            ],
          },
          {
            heading: "Créditos fotográficos",
            body: ["Atelier Reliure Dorure Ferrière, Orléans, Francia."],
          },
        ],
      },
      "privacy-policy": {
        title: "Política de privacidad",
        description:
          "Qué hacemos con la información que nos facilita al presentar su libro y cómo mantener el control sobre ella.",
        sections: [
          {
            heading: "Quién es responsable de sus datos",
            body: [
              "Fine Bindery es un servicio publicado por {{name}}, responsable del tratamiento descrito aquí. Su identidad completa figura en el {{notice}}.",
              "Para cualquier pregunta o solicitud: {{mail}}.",
            ],
          },
          {
            heading: "La información que nos facilita",
            body: [
              "Cuando presenta su libro: lo que describe sobre el libro y el proyecto — título, autor, naturaleza, dimensiones, estado, trabajos solicitados, valor y presupuesto orientativos, plazos —, las fotografías que añade y sus datos de contacto: nombre, correo electrónico, teléfono, código postal y ciudad.",
              "Si crea una cuenta de cliente: su correo electrónico y la información necesaria para iniciar sesión.",
            ],
          },
          {
            heading: "Datos técnicos",
            body: [
              "Para limitar los abusos, su dirección IP se transforma en una huella no reversible antes de registrarse. No conservamos la dirección IP en sí.",
              "Para medir el tráfico, cada página visitada se registra de forma anónima: la página, el sitio de procedencia, el idioma, el tipo de dispositivo y una huella que se renueva cada día. Esta medición no utiliza cookies.",
            ],
          },
          {
            heading: "Por qué la utilizamos",
            body: [
              "Para estudiar su proyecto, calcular su precio, seleccionar el taller con las competencias adecuadas, responderle y realizar el seguimiento de los trabajos; enviarle el resumen del proyecto; proteger el servicio contra abusos; comprender, de forma agregada, cómo se utiliza el sitio.",
            ],
          },
          {
            heading: "Con qué base",
            body: [
              "Su consentimiento, recabado antes de enviar el proyecto, y los intercambios precontractuales realizados a petición suya. Puede retirar el consentimiento en cualquier momento, sin afectar a lo realizado antes de su retirada.",
            ],
          },
          {
            heading: "Quién tiene acceso",
            body: [
              "El equipo de Fine Bindery. Los talleres asociados consultados para evaluar los trabajos reciben la descripción del proyecto y sus fotografías, sin sus datos de contacto. Solo el taller seleccionado para realizar el proyecto recibe sus datos de contacto.",
              "Sus datos no se venden ni se alquilan. Las fotografías de su libro nunca se publican.",
            ],
          },
          {
            heading: "Nuestros proveedores",
            body: [
              "La aplicación está alojada por {{webHost}}. La base de datos y las fotografías están alojadas por {{dataHost}}, en la región {{region}}.",
              "Los correos electrónicos, incluido el resumen de su proyecto, se envían mediante el servicio de correo de {{emailProvider}}, desde una dirección del dominio {{senderDomain}}.",
              "Cuando añade una fotografía de inspiración, un modelo de inteligencia artificial la analiza a través de {{ai}}; también se utiliza en algunas revisiones internas de proyectos. La inteligencia artificial nunca fija el precio de un proyecto.",
              "Algunos de estos proveedores están establecidos fuera de la Unión Europea. En esta página se publicará una lista detallada de los subencargados y de las garantías que rigen las posibles transferencias.",
            ],
          },
          {
            heading: "Cuánto tiempo la conservamos",
            body: [
              "El enlace al resumen de su proyecto sigue siendo válido durante {{days}} días.",
              "La información del proyecto se conserva mientras se estudia y se realiza su seguimiento. Los plazos definitivos de conservación aún se están estableciendo y se indicarán aquí. Puede solicitar la supresión de sus datos en cualquier momento.",
            ],
          },
          {
            heading: "Qué guarda el sitio en su navegador",
            body: [
              "Un identificador de sesión para retomar un proyecto interrumpido — «Presentar otro proyecto» lo borra; un identificador de visita para medir el tráfico, que se borra al cerrar la pestaña; y, si tiene una cuenta, su información de inicio de sesión.",
              "No se utilizan cookies publicitarias ni cookies de medición de audiencia de terceros.",
            ],
          },
          {
            heading: "Sus derechos",
            body: [
              "Puede acceder a sus datos, rectificarlos, hacer que se supriman, limitar su tratamiento, oponerse a él, recibir una copia en un formato reutilizable, retirar su consentimiento y establecer instrucciones sobre su destino tras su fallecimiento.",
              "Escríbanos a {{mail}}. Según su país de residencia, también puede tener derecho a presentar una reclamación ante su autoridad local de protección de datos — en Francia, la CNIL, {{cnil}}.",
            ],
          },
        ],
      },
      "terms-of-use": {
        title: "Condiciones de uso",
        description: "Qué puede esperar del sitio y qué compromisos todavía no implica.",
        sections: [
          {
            heading: "Objeto",
            body: [
              "Estas condiciones rigen el acceso al sitio Fine Bindery y el uso de su servicio de presentación de proyectos. El sitio está publicado por {{name}}.",
            ],
          },
          {
            heading: "El servicio",
            body: [
              "Puede presentar un libro y describir un proyecto — reparación, restauración, encuadernación, embellecimiento, transformación o protección — de forma gratuita y sin compromiso. Fine Bindery estudia los trabajos necesarios, puede ofrecerle un precio y encarga el proyecto a un taller artesano independiente en Francia con las competencias adecuadas.",
            ],
          },
          {
            heading: "Sin compromiso en esta fase",
            body: [
              "Enviar un proyecto no constituye un pedido ni una aceptación. Un precio solo es firme una vez confirmado por Fine Bindery para su proyecto.",
              "El pedido, el pago y el envío de su libro se rigen por las {{sales}}.",
            ],
          },
          {
            heading: "Su información y sus fotografías",
            body: [
              "Se compromete a proporcionar información exacta y garantiza que posee los derechos de las fotografías que envía. Estas fotografías se utilizan únicamente para estudiar y realizar el seguimiento de su proyecto; nunca se publican.",
            ],
          },
          {
            heading: "Uso del sitio",
            body: [
              "El sitio no debe utilizarse de forma abusiva: envíos automatizados, contenidos ilícitos, intentos de acceder a datos de otras personas o de perturbar el servicio.",
            ],
          },
          {
            heading: "Propiedad intelectual",
            body: [
              "Los textos, el nombre Fine Bindery y la presentación del sitio pertenecen a {{name}}. Las fotografías de trabajos terminados pertenecen al Atelier Reliure Dorure Ferrière de Orléans, Francia, y se reproducen con su permiso. Se prohíbe cualquier reproducción sin acuerdo previo.",
            ],
          },
          {
            heading: "Disponibilidad",
            body: [
              "Hacemos todo lo posible por mantener el sitio accesible, pero no podemos garantizar un funcionamiento ininterrumpido o sin errores.",
            ],
          },
          {
            heading: "Datos personales",
            body: ["El tratamiento de sus datos se describe en la {{privacy}}."],
          },
          {
            heading: "Cambios y legislación aplicable",
            body: [
              "Estas condiciones pueden cambiar; la versión aplicable es la publicada en esta página. Se rigen por la legislación francesa, sin perjuicio de las disposiciones más protectoras de las que se beneficie como consumidor conforme a la legislación de su propio país.",
              "Para cualquier pregunta: {{mail}}.",
            ],
          },
        ],
      },
      "terms-of-sale": {
        title: "Condiciones de venta",
        description:
          "Las condiciones que rigen su pedido desde el momento en que se confirma un precio para su proyecto.",
        sections: [
          {
            heading: "Objeto y ámbito de aplicación",
            body: [
              "Estas condiciones de venta rigen el pedido a Fine Bindery de un servicio de encuadernación, reparación, restauración, embellecimiento, transformación o protección de un libro, una vez confirmado un precio para su proyecto. Complementan, sin sustituirlas, las condiciones de uso y se rigen por la legislación francesa.",
            ],
          },
          {
            heading: "Las partes del contrato",
            body: [
              "Su contrato de venta se celebra con {{name}} («Fine Bindery»), que vende el servicio y sigue siendo su interlocutor para el pedido, el pago, el seguimiento y el servicio posventa.",
              "Fine Bindery elige el taller artesano que trabaja en su libro: usted no lo elige al hacer el pedido y el taller seleccionado se indica en su espacio de cliente. Es un colaborador de ejecución independiente, elegido por sus competencias. No es parte de su contrato de venta: usted no le paga directamente y Fine Bindery sigue siendo responsable ante usted de la correcta ejecución del servicio vendido.",
            ],
          },
          {
            heading: "Precio",
            body: [
              "El precio ofrecido para su proyecto se hace definitivo cuando lo confirma; coincide con el precio que aparece en su espacio de cliente al hacer el pedido, con todos los impuestos incluidos.",
              "El precio solo se debe una vez realizado el pedido según se describe a continuación; el pago se efectúa con tarjeta a través de nuestro proveedor de pagos, Stripe.",
            ],
          },
          {
            heading: "Pedido, aceptación del presupuesto y celebración del contrato",
            body: [
              "El presupuesto que le envía Fine Bindery se emite bajo la marca Fine Bindery; indica el servicio, el precio con impuestos y el plazo anunciado. Usted lo acepta expresamente marcando la aceptación del presupuesto y de estas condiciones antes de pagar. Esta aceptación se registra junto con la versión de las condiciones mostrada.",
              "El contrato de venta se celebra cuando ha aceptado el presupuesto y completado el pago del pedido. Recibe una confirmación del pedido por correo electrónico.",
            ],
          },
          {
            heading: "Facturación",
            body: [
              "La factura del pedido es emitida por {{name}} bajo la marca Fine Bindery, a la dirección de facturación facilitada al aceptar el presupuesto. Está disponible en su espacio de cliente. Si se realiza un reembolso, se emite una factura rectificativa.",
              "El taller que realiza el trabajo no le factura: factura a {{name}}.",
            ],
          },
          {
            heading: "Derecho de desistimiento",
            body: [
              "Si compra como consumidor dentro de la Unión Europea, generalmente dispone de un derecho de desistimiento de 14 días en una venta a distancia sin necesidad de dar una razón.",
              "{{review}} En particular: las condiciones exactas para ejercer este derecho, una posible excepción para un servicio personalizado sobre su libro, el modelo de desistimiento y lo aplicable a un cliente que compra desde fuera de la UE aún deben redactarse con un jurista antes de abrir cualquier venta real.",
            ],
          },
          {
            heading: "Prestación del servicio",
            body: [
              "Fine Bindery organiza la recogida y devolución de su libro una vez finalizado el servicio, tal como se describe en su espacio de cliente. Se le comunica cualquier retraso tan pronto como se conoce.",
            ],
          },
          {
            heading: "Transporte de ida y vuelta (opción)",
            body: [
              "Para un libro corriente con un valor declarado inferior a 100 €, embalado en un paquete de hasta 500 g y 35 × 25 × 8 cm, entre dos direcciones de Francia metropolitana (excepto Córcega), su propuesta puede incluir una línea separada de «Transporte de ida y vuelta» de 15 € IVA incluido. Cubre la etiqueta de ida, que le entregamos a usted, y la de vuelta, que entregamos al taller. En los demás casos, el transporte se presupuesta por separado, o lo organiza usted o entrega el libro en persona.",
              "Esta tarifa no incluye ningún seguro. Si el paquete se pierde o resulta dañado, solo puede aplicarse la indemnización del propio transportista: para Mondial Relay, como máximo 25 € por paquete, gastos de envío incluidos, previa prueba de su valor. Para un libro confiado para trabajos no se garantiza ninguna indemnización. Los libros antiguos, raros, únicos o de mayor valor no viajan con esta tarifa.",
              "Un escaneo de entrega del transportista no equivale a recepción: el propio taller confirma la recepción física y el estado del libro con fotografías. Si hay un problema, presentamos la reclamación al transportista dentro de sus plazos (daños: 3 días laborables después de la entrega; pérdida: 30 días) y le mantenemos informado en su espacio de cliente.",
            ],
          },
          {
            heading: "Garantías",
            body: [
              "{{review}} Las garantías legales de conformidad y de vicios ocultos aplicables conforme a la legislación francesa, y su relación con las garantías que puedan corresponder al cliente según la legislación de su país, aún deben redactarse con un jurista antes de abrir cualquier venta real.",
            ],
          },
          {
            heading: "Responsabilidad",
            body: [
              "{{review}} El alcance y los límites de la responsabilidad de Fine Bindery, en particular para un libro antiguo o de valor, aún deben definirse con un jurista antes de abrir cualquier venta real.",
            ],
          },
          { heading: "Mediación de consumo", body: ["{{mediator}}"] },
          {
            heading: "Datos personales",
            body: ["El tratamiento de sus datos se describe en la {{privacy}}."],
          },
          {
            heading: "Legislación aplicable y litigios",
            body: [
              "Estas condiciones se rigen por la legislación francesa, sin perjuicio de las disposiciones más protectoras de las que se beneficie como consumidor conforme a la legislación de su propio país.",
              "Para cualquier pregunta: {{mail}}.",
            ],
          },
        ],
      },
    },
  },
};
