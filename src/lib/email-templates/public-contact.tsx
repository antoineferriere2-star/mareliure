/* eslint-disable react-refresh/only-export-components */
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

interface PublicContactEmailProps {
  name?: string;
  email?: string;
  company?: string;
  subject?: string;
  message?: string;
  sourcePath?: string;
}

const PublicContactEmail = ({
  name,
  email,
  company,
  subject,
  message,
  sourcePath,
}: PublicContactEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`New contact message${subject ? ` - ${subject}` : ""}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>Métré Build</Text>
        <Heading style={heading}>New contact message</Heading>
        <Text style={paragraph}>A visitor submitted the contact form on metre-pro.com.</Text>

        <Section style={card}>
          <Text style={cardLabel}>From</Text>
          <Text style={cardText}>{name || "Not provided"}</Text>
          <Text style={cardText}>{email || "Not provided"}</Text>
          {company && <Text style={cardText}>{company}</Text>}
        </Section>

        <Section style={card}>
          <Text style={cardLabel}>Subject</Text>
          <Text style={cardText}>{subject || "General contact"}</Text>
        </Section>

        <Section style={card}>
          <Text style={cardLabel}>Message</Text>
          <Text style={cardText}>{message || "No message provided."}</Text>
        </Section>

        {sourcePath && (
          <Text style={meta}>
            Source page: <span>{sourcePath}</span>
          </Text>
        )}

        <Hr style={hr} />
        <Text style={footer}>
          Reply directly to this email to answer the visitor when a reply-to address is present.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: PublicContactEmail,
  subject: (data: Record<string, unknown>) =>
    data.subject ? `Métré Build contact - ${String(data.subject)}` : "Métré Build contact",
  displayName: "Public Contact",
  to: "contact@metre-pro.com",
  previewData: {
    name: "Jane Miller",
    email: "jane@example.com",
    company: "Sunrise Decks",
    subject: "Question about setup",
    message: "I would like to know whether Métré Build can work with our current website.",
    sourcePath: "/contact",
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
const meta = { fontSize: "12px", color: "#64748b", margin: "14px 0 0" };
const hr = { borderColor: "#e2e8f0", margin: "26px 0 14px" };
const footer = { fontSize: "12px", color: "#64748b", margin: 0 };
