// Visitor-facing confirmation email — distinct from new-dossier.tsx (which
// notifies workspace members). Rendered server-side via @react-email/render,
// no React context available, so copy is self-contained here rather than
// routed through the client-only publicLocaleContext.ts. Never receives the
// internal ProjectBrief or dossier id — only VisitorProjectSummary fields.
import * as React from "react";
import {
  Body,
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

interface VisitorSummaryEmailProps {
  locale?: "en-US" | "es-US";
  businessName?: string;
  summary?: string;
  confirmedItems?: SummaryItem[];
  calculatedItems?: SummaryItem[];
  budgetAndTimingItems?: SummaryItem[];
  itemsToConfirm?: SummaryItem[];
  nextStep?: string;
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
    disclaimer:
      "Este resumen refleja la información que proporcionó. No constituye una cotización final, una evaluación técnica ni una aprobación del proyecto.",
  },
} as const;

function itemLine(item: SummaryItem, i: number) {
  return (
    <Text key={i} style={cardText}>
      <strong>{item.label}:</strong> {item.value}
    </Text>
  );
}

const VisitorSummaryEmail = ({
  locale = "en-US",
  businessName = "",
  summary,
  confirmedItems = [],
  calculatedItems = [],
  budgetAndTimingItems = [],
  itemsToConfirm = [],
  nextStep,
}: VisitorSummaryEmailProps) => {
  const t = COPY[locale] ?? COPY["en-US"];
  const projectItems = [...confirmedItems, ...calculatedItems, ...budgetAndTimingItems];

  return (
    <Html lang={locale} dir="ltr">
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>Métré Build</Text>
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

          {/* Secure "view your summary" link is added once Lot 4 exists — never a raw dossier id. */}

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
    COPY[(data.locale as "en-US" | "es-US") ?? "en-US"].subject(
      typeof data.businessName === "string" ? data.businessName : "",
    ),
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
const cardLabel = { fontSize: "12px", fontWeight: 700, color: "#0f172a", margin: "0 0 6px" };
const cardText = { fontSize: "14px", lineHeight: "22px", color: "#334155", margin: "0 0 4px" };
const hr = { borderColor: "#e2e8f0", margin: "26px 0 14px" };
const footer = { fontSize: "12px", color: "#64748b", margin: 0 };
