// Invitation à rejoindre un atelier Ma Reliure (§7 du cahier des charges du
// 11 septembre 2026). Uniquement Ma Reliure : Métré Build n'a pas d'ateliers.
// Le jeton en clair n'apparaît que dans le lien — jamais journalisé, jamais
// renvoyé par une autre voie que cet e-mail (voir inviteBinderMember).
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
import { MARELIURE_CANONICAL_ORIGIN } from "@/marketplace/config";
import type { TemplateEntry } from "./registry";

interface BinderInvitationEmailProps {
  workshopName?: string;
  invitationToken?: string;
}

const BinderInvitationEmail = ({
  workshopName = "votre atelier",
  invitationToken = "",
}: BinderInvitationEmailProps) => {
  const acceptUrl = `${MARELIURE_CANONICAL_ORIGIN}/invitation-atelier/${invitationToken}`;
  return (
    <Html lang="fr">
      <Head />
      <Preview>Rejoignez {workshopName} sur Ma Reliure</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>Ma Reliure</Text>
          <Heading style={heading}>Rejoignez {workshopName}</Heading>
          <Text style={paragraph}>
            Ma Reliure vous invite à activer votre accès à l'espace atelier de{" "}
            <strong>{workshopName}</strong>. Ce lien est personnel et valable 7 jours ; il ne sert
            qu'une fois.
          </Text>
          <Section style={{ marginTop: "8px" }}>
            <Button href={acceptUrl} style={button}>
              Activer mon accès
            </Button>
          </Section>
          <Text style={footer}>
            Vous n'attendiez pas cette invitation ? Vous pouvez ignorer ce message : aucun accès ne
            sera ouvert sans confirmation.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template: TemplateEntry = {
  component: BinderInvitationEmail,
  subject: (data) =>
    `Rejoignez ${typeof data.workshopName === "string" ? data.workshopName : "votre atelier"} sur Ma Reliure`,
  displayName: "Binder Invitation",
  previewData: { workshopName: "Atelier Ferrière", invitationToken: "preview-token" },
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
const heading = { fontSize: "22px", color: "#17130f", margin: "0 0 16px" };
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
const footer = { fontSize: "13px", color: "#6d655a", marginTop: "28px" };
