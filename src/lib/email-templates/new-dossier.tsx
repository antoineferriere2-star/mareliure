import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface NewDossierEmailProps {
  missionName?: string;
  summary?: string;
  nextQuestions?: string[];
  dossierUrl?: string;
}

const NewDossierEmail = ({
  missionName,
  summary,
  nextQuestions = [],
  dossierUrl,
}: NewDossierEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>
      {`Nouveau Dossier Commercial${missionName ? ` — ${missionName}` : ""}`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>Métré Build</Text>
        <Heading style={heading}>Nouveau Dossier Commercial</Heading>
        <Text style={paragraph}>
          Un visiteur vient de terminer la Mission
          {missionName ? ` « ${missionName} »` : ""}. Son Dossier est disponible dans votre Espace
          Client.
        </Text>

        {summary && (
          <Section style={card}>
            <Text style={cardLabel}>Résumé</Text>
            <Text style={cardText}>{summary}</Text>
          </Section>
        )}

        {nextQuestions.length > 0 && (
          <Section style={card}>
            <Text style={cardLabel}>À demander au prochain contact</Text>
            {nextQuestions.slice(0, 6).map((q, i) => (
              <Text key={i} style={cardText}>
                • {q}
              </Text>
            ))}
          </Section>
        )}

        {dossierUrl && (
          <Section style={{ marginTop: "24px" }}>
            <Button href={dossierUrl} style={button}>
              Ouvrir le Dossier
            </Button>
          </Section>
        )}

        <Hr style={hr} />
        <Text style={footer}>
          Vous recevez cet e-mail parce que vous êtes membre de cet Espace Client Métré Build.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: NewDossierEmail,
  subject: (data: Record<string, unknown>) =>
    data.missionName
      ? `Nouveau Dossier Commercial — ${String(data.missionName)}`
      : "Nouveau Dossier Commercial",
  displayName: "Nouveau Dossier Commercial",
  previewData: {
    missionName: "Terrasse bois — Silvadec",
    summary: "Complete dossier ready for commercial review.",
    nextQuestions: ["Hauteur sous terrasse", "Accès chantier"],
    dossierUrl: "https://metre-pro.com/portal",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { padding: "28px 26px", maxWidth: "560px" };
const eyebrow = {
  fontSize: "12px",
  letterSpacing: "1.6px",
  textTransform: "uppercase" as const,
  color: "#047857",
  margin: "0 0 6px",
  fontWeight: 700,
};
const heading = { fontSize: "22px", color: "#0f172a", margin: "0 0 12px" };
const paragraph = { fontSize: "15px", lineHeight: "24px", color: "#334155", margin: "0 0 16px" };
const card = {
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "14px 16px",
  marginBottom: "12px",
};
const cardLabel = {
  fontSize: "12px",
  fontWeight: 700,
  color: "#0f172a",
  margin: "0 0 6px",
};
const cardText = { fontSize: "14px", lineHeight: "22px", color: "#334155", margin: "0 0 4px" };
const button = {
  backgroundColor: "#047857",
  color: "#ffffff",
  borderRadius: "8px",
  padding: "12px 20px",
  fontSize: "14px",
  fontWeight: 700,
  textDecoration: "none",
};
const hr = { borderColor: "#e2e8f0", margin: "26px 0 14px" };
const footer = { fontSize: "12px", color: "#64748b", margin: 0 };
