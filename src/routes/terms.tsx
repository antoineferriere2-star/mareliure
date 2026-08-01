// LEGAL REVIEW REQUIRED before production publication.
// The sections below are a complete, honest draft written by engineering to
// reflect what the product actually does — they have not been reviewed by a
// lawyer. The governing-law placeholder is phrased as "to be confirmed"
// rather than invented. Do not replace it with a plausible-sounding
// jurisdiction without verifying it first.
import { createFileRoute } from "@tanstack/react-router";
import { BuildLegalPage, type LegalSection } from "@/build/pages/public/BuildMarketingPages";
import { breadcrumbSchema, jsonLdScript, SITE_URL } from "@/lib/structured-data";

const title = "Terms — Métré Build";
const description =
  "The terms that apply when you use Métré Build for project discovery, guided intake and Project Brief qualification.";

const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: "What this service is",
    body: [
      "Métré Build is a guided project-intake tool: it helps a visitor describe a project — a deck project today — and turns the answers into a structured Project Brief for the business that published the intake.",
    ],
  },
  {
    heading: "Creating an account",
    body: [
      "Creating a workspace account gives you a self-service space to publish a Guided Project Intake and review the Project Briefs it produces. You are responsible for keeping your account credentials secure.",
    ],
  },
  {
    heading: "Authorized use",
    body: [
      "You agree not to use Métré Build to submit false information at scale, attempt to disrupt the service, or extract other workspaces' data.",
    ],
  },
  {
    heading: "Your responsibilities as a workspace owner",
    body: [
      "If you operate a workspace, you are responsible for the accuracy of the Playbook you publish, for how you use the Project Briefs you receive, and for your own compliance obligations toward the visitors your Guided Project Intake collects information from.",
    ],
  },
  {
    heading: "Service limitations",
    body: [
      "Métré Build assists project discovery and qualification. It does not replace professional judgment, a site visit, or a formal proposal process.",
    ],
  },
  {
    heading: "No final quote or price guarantee",
    body: [
      "Nothing produced by a Guided Project Intake or a Project Brief is a binding price quote. Budget ranges and estimates are visitor-provided or calculated approximations, clearly marked as such.",
    ],
  },
  {
    heading: "No technical or engineering validation",
    body: [
      "A Project Brief is not an engineering assessment, a permit review, or a regulatory determination. Any measurements, materials, or site conditions it lists are visitor-reported or AI-assisted observations to be verified on site.",
    ],
  },
  {
    heading: "Data you submit",
    body: [
      "You are responsible for having the right to submit any information, photo, or document you upload through a Guided Project Intake or as a workspace owner.",
    ],
  },
  {
    heading: "Content and photos",
    body: [
      "You retain ownership of the photos and content you submit. You grant Métré Build the license needed to store, process, and display that content back to the relevant workspace for the purpose of generating and reviewing a Project Brief.",
    ],
  },
  {
    heading: "Intellectual property",
    body: [
      "The Métré Build product, its Playbooks, and its software are the property of the team operating the service. Nothing in these Terms transfers that ownership to you.",
    ],
  },
  {
    heading: "Availability",
    body: [
      "We aim to keep the service available but do not guarantee uninterrupted access. Features may change as the product evolves.",
    ],
  },
  {
    heading: "Suspension",
    body: [
      "We may suspend access to a workspace that violates these Terms or that we reasonably believe is abusing the service, after attempting to notify you where practical.",
    ],
  },
  {
    heading: "Termination",
    body: [
      "You may stop using the service at any time. We may discontinue or change the service with reasonable notice.",
    ],
  },
  {
    heading: "Limitation of liability",
    body: [
      "To the extent permitted by law, Métré Build is provided without warranties of any kind, and liability for any claim related to the service is limited as far as applicable law allows.",
    ],
  },
  {
    heading: "Governing law",
    body: [
      "The governing law and jurisdiction for these Terms are to be confirmed based on where the operating entity is registered and where its customers are located.",
    ],
  },
  {
    heading: "Contact",
    body: ["Questions about these Terms can be sent through the Contact page."],
  },
];

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/terms` },
      { property: "og:image", content: `${SITE_URL}/og-image.png` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/terms` }],
    scripts: [jsonLdScript(breadcrumbSchema([{ name: "Terms", path: "/terms" }]))],
  }),
  component: () => <BuildLegalPage title="Terms" updated="2026-08-01" sections={TERMS_SECTIONS} />,
});
