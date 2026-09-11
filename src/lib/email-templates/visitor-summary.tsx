// Visitor-facing confirmation email — distinct from new-dossier.tsx (which
// notifies workspace members). Rendered server-side via @react-email/render,
// no React context available, so copy is self-contained here rather than
// routed through the client-only publicLocaleContext.ts. Never receives the
// internal ProjectBrief or dossier id — only VisitorProjectSummary fields,
// plus what the sending brand adds: its name, its colour and, when it has
// one, the space where the visitor follows the project.
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

type SummaryItem = { label: string; value: string };
type EmailLocale = "en-US" | "es-US" | "fr-FR";

interface VisitorSummaryEmailProps {
  locale?: EmailLocale;
  businessName?: string;
  /** The brand sending the email, shown above the heading. */
  brandName?: string;
  /** Eyebrow and primary button colour. */
  accentColor?: string;
  summary?: string;
  confirmedItems?: SummaryItem[];
  calculatedItems?: SummaryItem[];
  budgetAndTimingItems?: SummaryItem[];
  itemsToConfirm?: SummaryItem[];
  nextStep?: string;
  summaryUrl?: string;
  /** Where the visitor follows the project, when the brand offers such a space. */
  trackUrl?: string;
}

const COPY = {
  "en-US": {
    subject: (businessName: string) => `Your project summary from ${businessName}`,
    preview: "Your project summary is ready.",
    heading: "Your project summary is ready",
    intro: (businessName: string) => `Your information has been sent to ${businessName}.`,
    projectSummary: "Project summary",
    stillToConfirm: "Still to confirm",
    whatsNext: "What happens next",
    viewSummary: "View your project summary",
    trackHeading: "Follow your project",
    trackIntro:
      "Your project and its progress are waiting in your customer space. To sign in, enter this email address: we'll send you a sign-in link, no password needed.",
    trackButton: "Follow my project",
    disclaimer:
      "This summary reflects the information you provided. It is not a final quote, technical assessment or project approval.",
  },
  "es-US": {
    subject: (businessName: string) => `Resumen de su proyecto de ${businessName}`,
    preview: "El resumen de su proyecto está listo.",
    heading: "El resumen de su proyecto está listo",
    intro: (businessName: string) => `Su información ha sido enviada a ${businessName}.`,
    projectSummary: "Resumen del proyecto",
    stillToConfirm: "Aún por confirmar",
    whatsNext: "Qué sigue",
    viewSummary: "Ver el resumen de su proyecto",
    trackHeading: "Siga su proyecto",
    trackIntro:
      "Su proyecto y su avance le esperan en su espacio de cliente. Para entrar, indique esta dirección de correo: le enviaremos un enlace de acceso, sin contraseña.",
    trackButton: "Seguir mi proyecto",
    disclaimer:
      "Este resumen refleja la información que proporcionó. No constituye una cotización final, una evaluación técnica ni una aprobación del proyecto.",
  },
  "fr-FR": {
    subject: (businessName: string) => `Le récapitulatif de votre projet — ${businessName}`,
    preview: "Nous avons bien reçu votre projet.",
    heading: "Nous avons bien reçu votre projet",
    intro: (businessName: string) => `Vos informations ont été transmises à ${businessName}.`,
    projectSummary: "Récapitulatif du projet",
    stillToConfirm: "Reste à préciser",
    whatsNext: "La suite",
    viewSummary: "Revoir le récapitulatif",
    trackHeading: "Suivre votre projet",
    trackIntro:
      "Votre projet et son avancement vous attendent dans votre espace. Pour y entrer, indiquez cette adresse e-mail : nous vous enverrons un lien de connexion, sans mot de passe.",
    trackButton: "Suivre mon projet",
    disclaimer:
      "Ce récapitulatif reprend les informations que vous avez fournies. Ce n'est ni un devis définitif, ni une évaluation technique, ni l'acceptation du projet.",
  },
} as const;

function copyFor(locale: unknown) {
  return COPY[locale as EmailLocale] ?? COPY["en-US"];
}

function itemLine(item: SummaryItem, i: number) {
  return (
    <Text key={i} style={cardText}>
      <strong>{item.label}:</strong> {item.value}
    </Text>
  );
}

const DEFAULT_BRAND = "Métré Build";
const DEFAULT_ACCENT = "#047857";

const VisitorSummaryEmail = ({
  locale = "en-US",
  businessName = "",
  brandName = DEFAULT_BRAND,
  accentColor = DEFAULT_ACCENT,
  summary,
  confirmedItems = [],
  calculatedItems = [],
  budgetAndTimingItems = [],
  itemsToConfirm = [],
  nextStep,
  summaryUrl,
  trackUrl,
}: VisitorSummaryEmailProps) => {
  const t = copyFor(locale);
  const projectItems = [...confirmedItems, ...calculatedItems, ...budgetAndTimingItems];

  return (
    <Html lang={locale} dir="ltr">
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={{ ...eyebrow, color: accentColor }}>{brandName}</Text>
          <Heading style={heading}>{t.heading}</Heading>
          <Text style={paragraph}>{t.intro(businessName)}</Text>

          <Section style={card}>
            <Text style={cardLabel}>{t.projectSummary}</Text>
            {summary && <Text style={cardText}>{summary}</Text>}
            {projectItems.map(itemLine)}
          </Section>

          {itemsToConfirm.length > 0 && (
            <Section style={card}>
              <Text style={cardLabel}>{t.stillToConfirm}</Text>
              {itemsToConfirm.map(itemLine)}
            </Section>
          )}

          {nextStep && (
            <Section style={card}>
              <Text style={cardLabel}>{t.whatsNext}</Text>
              <Text style={cardText}>{nextStep}</Text>
            </Section>
          )}

          {trackUrl && (
            <Section style={card}>
              <Text style={cardLabel}>{t.trackHeading}</Text>
              <Text style={cardText}>{t.trackIntro}</Text>
              <Section style={{ marginTop: "10px" }}>
                <Button href={trackUrl} style={{ ...button, backgroundColor: accentColor }}>
                  {t.trackButton}
                </Button>
              </Section>
            </Section>
          )}

          {summaryUrl && (
            <Section style={{ marginTop: "8px" }}>
              <Button
                href={summaryUrl}
                style={
                  trackUrl
                    ? { ...secondaryButton, color: accentColor, borderColor: accentColor }
                    : { ...button, backgroundColor: accentColor }
                }
              >
                {t.viewSummary}
              </Button>
            </Section>
          )}

          <Hr style={hr} />
          <Text style={footer}>{t.disclaimer}</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: VisitorSummaryEmail,
  subject: (data: Record<string, unknown>) =>
    copyFor(data.locale).subject(typeof data.businessName === "string" ? data.businessName : ""),
  displayName: "Visitor Project Summary",
  previewData: {
    locale: "en-US",
    businessName: "Sanibel Decks",
    summary: "New composite deck, roughly 16 ft x 20 ft.",
    confirmedItems: [{ label: "Existing structure", value: "Existing wood deck" }],
    calculatedItems: [{ label: "Approximate area", value: "320 sq ft" }],
    budgetAndTimingItems: [{ label: "Budget", value: "$25,000-$35,000" }],
    itemsToConfirm: [{ label: "Access", value: "Visitor reported access limitations." }],
    nextStep: "Thanks! We'll reach out within 24 hours.",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { padding: "28px 26px", maxWidth: "560px" };
const eyebrow = {
  fontSize: "12px",
  letterSpacing: "1.6px",
  textTransform: "uppercase" as const,
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
const cardLabel = { fontSize: "12px", fontWeight: 700, color: "#0f172a", margin: "0 0 6px" };
const cardText = { fontSize: "14px", lineHeight: "22px", color: "#334155", margin: "0 0 4px" };
const button = {
  color: "#ffffff",
  borderRadius: "8px",
  padding: "12px 20px",
  fontSize: "14px",
  fontWeight: 700,
  textDecoration: "none",
};
const secondaryButton = {
  backgroundColor: "#ffffff",
  border: "1px solid",
  borderRadius: "8px",
  padding: "11px 19px",
  fontSize: "14px",
  fontWeight: 700,
  textDecoration: "none",
};
const hr = { borderColor: "#e2e8f0", margin: "26px 0 14px" };
const footer = { fontSize: "12px", color: "#64748b", margin: 0 };
