/* eslint-disable react-refresh/only-export-components */
/**
 * Le seul e-mail du suivi de commande : « il se passe quelque chose, venez
 * voir ». Jamais le contenu d'un message ni la question posée — l'échange
 * reste dans l'espace Ma Reliure.
 */
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
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

type Notice = "decision_requested" | "binder_message" | "book_received" | "work_finished";

const COPY: Record<Notice, { subject: string; heading: string; body: string }> = {
  decision_requested: {
    subject: "L'atelier a une question concernant votre livre",
    heading: "Votre réponse est attendue",
    body: "L'atelier a besoin de votre choix pour poursuivre le travail. La question vous attend dans votre espace Ma Reliure.",
  },
  binder_message: {
    subject: "Un message de l'atelier vous attend",
    heading: "L'atelier vous a écrit",
    body: "Un nouveau message au sujet de votre livre vous attend dans votre espace Ma Reliure.",
  },
  book_received: {
    subject: "Votre livre est arrivé à l'atelier",
    heading: "Votre livre est à l'atelier",
    body: "L'atelier a bien reçu votre livre. Vous pourrez suivre son travail et échanger avec lui depuis votre espace Ma Reliure.",
  },
  work_finished: {
    subject: "Votre livre est terminé",
    heading: "Votre livre est terminé",
    body: "L'atelier a terminé le travail sur votre livre. Nous préparons son retour.",
  },
};

function isNotice(value: unknown): value is Notice {
  return typeof value === "string" && value in COPY;
}

interface ProjectNotificationProps {
  notice?: string;
  reference?: string;
  projectUrl?: string;
}

const ProjectNotificationEmail = ({ notice, reference, projectUrl }: ProjectNotificationProps) => {
  const copy = COPY[isNotice(notice) ? notice : "binder_message"];
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>{copy.subject}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>Ma Reliure{reference ? ` · ${reference}` : ""}</Text>
          <Heading style={heading}>{copy.heading}</Heading>
          <Text style={paragraph}>{copy.body}</Text>
          {projectUrl && (
            <Button href={projectUrl} style={button}>
              Voir mon projet
            </Button>
          )}
          <Hr style={hr} />
          <Text style={footer}>
            Ma Reliure vous écrit dans le cadre du suivi de votre commande. Les échanges avec
            l'atelier se font depuis votre espace, et non par e-mail.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: ProjectNotificationEmail,
  subject: (data: Record<string, unknown>) =>
    COPY[isNotice(data.notice) ? data.notice : "binder_message"].subject,
  displayName: "Suivi de commande",
  previewData: {
    notice: "decision_requested",
    reference: "RL-007",
    projectUrl: "https://mareliure.fr/mes-livres/00000000-0000-0000-0000-000000000000",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#fbfaf7", fontFamily: "Georgia, 'Times New Roman', serif" };
const container = { padding: "32px 28px", maxWidth: "560px" };
const eyebrow = {
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "12px",
  letterSpacing: "1.4px",
  textTransform: "uppercase" as const,
  color: "#6d655a",
  margin: "0 0 10px",
};
const heading = { fontSize: "26px", fontWeight: 400, color: "#17130f", margin: "0 0 14px" };
const paragraph = {
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "15px",
  lineHeight: "24px",
  color: "#3c352d",
  margin: "0 0 22px",
};
const button = {
  fontFamily: "Arial, Helvetica, sans-serif",
  backgroundColor: "#17130f",
  color: "#fbfaf7",
  fontSize: "14px",
  fontWeight: 600,
  padding: "12px 20px",
  borderRadius: "2px",
  textDecoration: "none",
};
const hr = { borderColor: "#ddd6c9", margin: "28px 0 14px" };
const footer = {
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "12px",
  lineHeight: "18px",
  color: "#6d655a",
  margin: 0,
};
