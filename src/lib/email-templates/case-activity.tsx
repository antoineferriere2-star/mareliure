// Notification transactionnelle générique pour l'activité d'un dossier —
// nouveau message, décision demandée (§19). Marketplace uniquement (Ma
// Reliure / Fine Bindery) : la messagerie et les décisions sont des
// fonctions marketplace, pas Métré. Le contenu du message n'est
// délibérément pas repris ici en entier — un CTA vers l'espace, pas la
// conversation recopiée dans un e-mail.
//
// Brand-aware depuis le chantier GTM du 18 septembre 2026 : ce gabarit
// servait jusque-là toujours "Ma Reliure" en français, y compris pour un
// client Fine Bindery — voir send-email.ts pour la même correction côté
// expéditeur.
import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

type Locale = "fr-FR" | "en-US" | "de-DE" | "it-IT" | "es-ES";

interface CaseActivityEmailProps {
  brandName?: string;
  locale?: Locale;
  heading?: string;
  intro?: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

const FALLBACK_CTA_LABEL: Record<Locale, string> = {
  "fr-FR": "Voir mon livre",
  "en-US": "View my book",
  "de-DE": "Mein Buch ansehen",
  "it-IT": "Vedi il mio libro",
  "es-ES": "Ver mi libro",
};

function copyForLocale(locale: unknown): Locale {
  return locale === "fr-FR" || locale === "en-US" || locale === "de-DE" || locale === "it-IT" || locale === "es-ES" ? locale : "en-US";
}

const CaseActivityEmail = ({
  brandName = "Ma Reliure",
  locale = "fr-FR",
  heading,
  intro,
  ctaLabel,
  ctaUrl = "https://mareliure.fr/mes-livres",
}: CaseActivityEmailProps) => {
  const resolvedLocale = copyForLocale(locale);
  const resolvedHeading =
    heading ?? (resolvedLocale === "en-US" ? "Your project has moved forward" : "Votre projet a évolué");
  const resolvedIntro =
    intro ??
    (resolvedLocale === "en-US"
      ? `There's news on your ${brandName} project.`
      : `Il y a du nouveau sur votre projet ${brandName}.`);
  return (
    <Html lang={resolvedLocale}>
      <Head />
      <Preview>{resolvedIntro}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>{brandName}</Text>
          <Heading style={heading_}>{resolvedHeading}</Heading>
          <Text style={paragraph}>{resolvedIntro}</Text>
          <Section style={{ marginTop: "8px" }}>
            <Button href={ctaUrl} style={button}>
              {ctaLabel ?? FALLBACK_CTA_LABEL[resolvedLocale]}
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export const template: TemplateEntry = {
  component: CaseActivityEmail,
  subject: (data) => (typeof data.heading === "string" ? data.heading : "Votre projet a évolué"),
  displayName: "Case Activity",
  previewData: {
    brandName: "Fine Bindery",
    locale: "en-US",
    heading: "New message about your project",
    intro: "Your workshop wrote to you about your book.",
    ctaLabel: "View the conversation",
    ctaUrl: "https://finebindery.com/mes-livres/preview",
  },
};

const main = { backgroundColor: "#fbfaf7", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { margin: "0 auto", padding: "40px 20px", maxWidth: "560px" };
const eyebrow = {
  fontSize: "12px",
  letterSpacing: "1.6px",
  textTransform: "uppercase" as const,
  color: "#17130f",
  margin: "0 0 6px",
  fontWeight: 700,
};
const heading_ = { fontSize: "22px", color: "#17130f", margin: "0 0 16px" };
const paragraph = { fontSize: "15px", lineHeight: "24px", color: "#3c352d" };
const button = {
  backgroundColor: "#17130f",
  color: "#fbfaf7",
  borderRadius: "2px",
  padding: "12px 22px",
  fontSize: "14px",
  fontWeight: 700,
  textDecoration: "none",
  display: "inline-block",
};
