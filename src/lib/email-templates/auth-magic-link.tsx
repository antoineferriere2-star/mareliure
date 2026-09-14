/**
 * L'e-mail de connexion client — lien et code, une seule adresse
 * (`{{ .ConfirmationURL }}`/`{{ .Token }}` dans les anciens modèles Supabase
 * `supabase/templates/mareliure/magic-link.html`, désormais rendu ici parce
 * que le hook « Send Email » (Phase F, e-mails brand-aware) intercepte
 * l'envoi avant que Supabase ne rende son propre modèle unique par projet).
 *
 * Envoyé par `authEmailHook.server.ts` pour `email_action_type ===
 * "magiclink"`, quelle que soit la marque : c'est le seul e-mail
 * d'authentification qu'un client — Ma Reliure ou Fine Bindery — reçoit
 * jamais (§ voir MaReliureAuthPage.tsx, showBinderTab). `locale` choisit le
 * texte ; `brandName`/`accentColor` reprennent exactement ceux déjà utilisés
 * par visitor-summary.tsx pour la même paire de marques.
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

type Locale = "fr-FR" | "en-US";

interface AuthMagicLinkEmailProps {
  brandName?: string;
  accentColor?: string;
  confirmationUrl?: string;
  code?: string;
  locale?: Locale;
}

const COPY: Record<Locale, {
  preview: (brand: string) => string;
  heading: string;
  intro: (brand: string) => string;
  button: string;
  codeIntro: string;
  ignore: string;
}> = {
  "fr-FR": {
    preview: (brand) => `Votre lien de connexion ${brand}`,
    heading: "Votre lien de connexion",
    intro: (brand) =>
      `Voici votre lien pour entrer dans votre espace ${brand} et suivre votre livre. Il est valable une heure et ne sert qu'une fois.`,
    button: "Ouvrir mon espace",
    codeIntro: "Vous préférez saisir un code plutôt que d'ouvrir ce lien ? Utilisez celui-ci :",
    ignore: "Vous n'avez pas demandé ce lien ? Vous pouvez ignorer ce message.",
  },
  "en-US": {
    preview: (brand) => `Your ${brand} sign-in link`,
    heading: "Your sign-in link",
    intro: (brand) =>
      `Here is your link to enter your ${brand} space and follow your book. It's valid for one hour and works only once.`,
    button: "Open my space",
    codeIntro: "Prefer to type a code instead of opening this link? Use this one:",
    ignore: "You didn't request this link? You can safely ignore this message.",
  },
};

function copyFor(locale: unknown) {
  return COPY[locale as Locale] ?? COPY["fr-FR"];
}

export const AuthMagicLinkEmail = ({
  brandName = "Ma Reliure",
  accentColor = "#17130f",
  confirmationUrl = "",
  code = "",
  locale = "fr-FR",
}: AuthMagicLinkEmailProps) => {
  const t = copyFor(locale);
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{t.preview(brandName)}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={{ ...eyebrow, color: accentColor }}>{brandName}</Text>
          <Heading style={heading}>{t.heading}</Heading>
          <Text style={paragraph}>{t.intro(brandName)}</Text>
          <Section style={{ marginTop: "8px" }}>
            <Button href={confirmationUrl} style={{ ...button, backgroundColor: accentColor }}>
              {t.button}
            </Button>
          </Section>
          {code && (
            <>
              <Text style={{ ...paragraph, marginTop: "28px" }}>{t.codeIntro}</Text>
              <Text style={codeStyle}>{code}</Text>
            </>
          )}
          <Text style={footer}>{t.ignore}</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template: TemplateEntry = {
  component: AuthMagicLinkEmail,
  subject: (data) => copyFor(data.locale).preview(String(data.brandName ?? "Ma Reliure")),
  displayName: "Auth — Magic Link",
  previewData: {
    brandName: "Fine Bindery",
    accentColor: "#17130f",
    confirmationUrl: "https://example.supabase.co/auth/v1/verify?token=preview&type=magiclink",
    code: "12345678",
    locale: "en-US",
  },
};

const main = { backgroundColor: "#fbfaf7", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { margin: "0 auto", padding: "40px 20px", maxWidth: "560px" };
const eyebrow = {
  fontSize: "12px",
  letterSpacing: "1.6px",
  textTransform: "uppercase" as const,
  margin: "0 0 6px",
  fontWeight: 700,
};
const heading = { fontSize: "22px", color: "#17130f", margin: "0 0 16px" };
const paragraph = { fontSize: "15px", lineHeight: "24px", color: "#3c352d" };
const button = {
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
