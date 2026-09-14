/**
 * Confirmation d'inscription par mot de passe — atelier/équipe uniquement
 * (`PasswordSignUp`, MaReliureAuthPage.tsx : rendu seulement quand
 * `showBinderTab` est vrai, donc jamais sur Fine Bindery). Toujours français
 * — l'atelier reste l'atelier, quelle que soit la marque du dossier (même
 * règle que RequestDecisionForm dans DecisionsPanel.tsx). Porte le contenu de
 * l'ancien `supabase/templates/mareliure/confirmation.html`.
 */
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

interface AuthSignupConfirmationEmailProps {
  confirmationUrl?: string;
  code?: string;
}

export const AuthSignupConfirmationEmail = ({
  confirmationUrl = "",
  code = "",
}: AuthSignupConfirmationEmailProps) => (
  <Html lang="fr">
    <Head />
    <Preview>Ouvrez votre espace Ma Reliure</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>Ma Reliure</Text>
        <Heading style={heading}>Confirmez votre adresse</Heading>
        <Text style={paragraph}>
          Pour ouvrir votre espace Ma Reliure et suivre votre livre, confirmez votre adresse
          e-mail. Ce lien est valable une heure.
        </Text>
        <Section style={{ marginTop: "8px" }}>
          <Button href={confirmationUrl} style={button}>
            Confirmer et ouvrir mon espace
          </Button>
        </Section>
        {code && (
          <>
            <Text style={{ ...paragraph, marginTop: "28px" }}>
              Vous préférez saisir un code plutôt que d'ouvrir ce lien ? Utilisez celui-ci :
            </Text>
            <Text style={codeStyle}>{code}</Text>
          </>
        )}
        <Text style={footer}>
          Vous n'avez rien demandé à Ma Reliure ? Vous pouvez ignorer ce message : aucun espace ne
          sera ouvert sans cette confirmation.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template: TemplateEntry = {
  component: AuthSignupConfirmationEmail,
  subject: "Ouvrez votre espace Ma Reliure",
  displayName: "Auth — Confirmation d'inscription",
  previewData: {
    confirmationUrl: "https://example.supabase.co/auth/v1/verify?token=preview&type=signup",
    code: "12345678",
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
const codeStyle = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "28px",
  letterSpacing: "4px",
  color: "#17130f",
  margin: "8px 0 0",
};
const footer = { fontSize: "13px", color: "#6d655a", marginTop: "28px" };
