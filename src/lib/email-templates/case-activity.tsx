// Notification transactionnelle générique pour l'activité d'un dossier —
// nouveau message, décision demandée (§19). Ma Reliure uniquement : la
// messagerie et les décisions sont des fonctions marketplace, pas Métré.
// Le contenu du message n'est délibérément pas repris ici en entier — un CTA
// vers l'espace, pas la conversation recopiée dans un e-mail.
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

interface CaseActivityEmailProps {
  heading?: string;
  intro?: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

const CaseActivityEmail = ({
  heading = "Votre projet a évolué",
  intro = "Il y a du nouveau sur votre projet Ma Reliure.",
  ctaLabel = "Voir mon livre",
  ctaUrl = "https://mareliure.fr/mes-livres",
}: CaseActivityEmailProps) => (
  <Html lang="fr">
    <Head />
    <Preview>{intro}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>Ma Reliure</Text>
        <Heading style={heading_}>{heading}</Heading>
        <Text style={paragraph}>{intro}</Text>
        <Section style={{ marginTop: "8px" }}>
          <Button href={ctaUrl} style={button}>
            {ctaLabel}
          </Button>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template: TemplateEntry = {
  component: CaseActivityEmail,
  subject: (data) => (typeof data.heading === "string" ? data.heading : "Votre projet a évolué"),
  displayName: "Case Activity",
  previewData: {
    heading: "Nouveau message sur votre projet",
    intro: "Votre atelier vous a écrit au sujet de votre livre.",
    ctaLabel: "Voir la conversation",
    ctaUrl: "https://mareliure.fr/mes-livres/preview",
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
