// LEGAL REVIEW REQUIRED before production publication.
// The sections below are a complete, honest draft written by engineering to
// reflect what the product actually does — they have not been reviewed by a
// lawyer. Placeholders for facts we don't have yet (legal entity name,
// registered address, DPO, governing law, contractual retention periods)
// are phrased as "to be confirmed" rather than invented. Do not replace
// them with plausible-sounding values without verifying them first.
import { createFileRoute } from "@tanstack/react-router";
import { BuildLegalPage, type LegalSection } from "@/build/pages/public/BuildMarketingPages";
import {
  breadcrumbSchema,
  jsonLdScript,
  PUBLIC_CONTACT_EMAIL,
  SITE_URL,
} from "@/lib/structured-data";

const title = "Privacy — Métré Build";
const description =
  "How Métré Build collects, uses and protects the information you submit through our audit, setup request, contact and Guided Project Intake forms.";

const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: "Who operates Métré Build",
    body: [
      "Métré Build (metre-pro.com) is a project intake product for businesses that need to understand project context before they sell. The legal entity operating this service, its registration details and registered address will be published here once confirmed — until then, use the Contact page for any verification you need.",
    ],
  },
  {
    heading: "Data we collect",
    body: [
      "We collect information you submit directly through our audit request, setup request and contact forms, and information a visitor submits through a Guided Project Intake published by one of our client workspaces.",
    ],
  },
  {
    heading: "Information collected in a Guided Project Intake",
    body: [
      "Depending on the Playbook a workspace publishes, a Guided Project Intake may ask for project details, dimensions, material or feature preferences, budget range, timing, site photos, and consent to be contacted.",
    ],
  },
  {
    heading: "Contact details",
    body: [
      "Name, email address, phone number and ZIP/postal code, when provided, are used to let the relevant workspace follow up on a project.",
    ],
  },
  {
    heading: "Photos and documents",
    body: [
      "Photos or plans uploaded to a Guided Project Intake are stored so the workspace can review the project and, where that feature is enabled, may be analyzed by an AI vision service to surface observations for the workspace to confirm.",
    ],
  },
  {
    heading: "Technical data",
    body: [
      "We collect limited technical data needed to operate the service and protect it from abuse: IP address (hashed before storage for rate-limiting), browser locale, and basic request metadata. We do not use this data for advertising.",
    ],
  },
  {
    heading: "Purposes of processing",
    body: [
      "We use this information to operate the Guided Project Intake, generate a Project Brief for the relevant workspace, respond to audit, contact and setup requests, protect the service from abuse, and improve the product.",
    ],
  },
  {
    heading: "Legal basis",
    body: [
      "The applicable legal basis for processing (for example consent, contract performance, or legitimate interest) depends on the visitor's jurisdiction and the specific data involved, and is to be confirmed with legal counsel for each territory we serve.",
    ],
  },
  {
    heading: "Workspaces and team members",
    body: [
      "A business using Métré Build operates its own workspace. Project Briefs and visitor information submitted through that workspace's Guided Project Intake are visible to the members of that workspace, not to other Métré Build customers.",
    ],
  },
  {
    heading: "Service providers and subprocessors",
    body: [
      "We rely on third-party service providers to operate Métré Build. We have not yet published a complete, versioned subprocessor list — the categories of providers we currently use are described in the sections below.",
    ],
  },
  {
    heading: "Hosting",
    body: ["The application and its database are hosted on Supabase."],
  },
  {
    heading: "Email delivery",
    body: [
      "Transactional emails — confirmations, Project Summary copies, and contact replies — are sent through Lovable's managed email delivery service.",
    ],
  },
  {
    heading: "AI-assisted processing",
    body: [
      "Some features — drafting a Project Brief, analyzing an uploaded photo, or answering a free-text question in the site's FAQ assistant — send the relevant text or image to an AI model through the Lovable AI Gateway. We do not use this content to train AI models ourselves.",
    ],
  },
  {
    heading: "Retention",
    body: [
      "We keep this information for as long as the relevant Mission or workspace account is active, plus a reasonable period afterward to respond to follow-up questions. We have not yet set contractual, jurisdiction-specific retention periods — this section will be updated once that review is complete.",
    ],
  },
  {
    heading: "Deletion",
    body: [
      "You can request deletion of your information at any time via the Contact page. We will delete or anonymize it unless we are required to keep it for a legitimate purpose, such as an unresolved dispute.",
    ],
  },
  {
    heading: "Security",
    body: [
      "We limit access to visitor and customer data to the systems and team members that need it, and rely on our hosting and email providers' own security controls. No online service can guarantee absolute security.",
    ],
  },
  {
    heading: "Cookies and similar technologies",
    body: [
      "The public site stores your language preference (English/Spanish) and, during a Guided Project Intake, a session identifier, using your browser's local storage rather than tracking cookies. We do not currently use third-party advertising or analytics cookies.",
    ],
  },
  {
    heading: "Your rights",
    body: [
      "Depending on your location, you may have the right to access, correct, delete, or receive a copy of your information, and to object to certain processing. Contact us via the Contact page to exercise these rights.",
    ],
  },
  {
    heading: "Visitors in the United States",
    body: [
      "Depending on your state of residence, you may have additional rights under state privacy law. We will confirm the specific rights that apply once we complete a jurisdiction-by-jurisdiction legal review.",
    ],
  },
  {
    heading: "Visitors in the European Economic Area",
    body: [
      "If you are located in the EEA, UK or Switzerland, additional rights under the GDPR may apply, including the right to lodge a complaint with your local data protection authority. Our EU-specific legal basis and representative details are to be confirmed.",
    ],
  },
  {
    heading: "Contact",
    body: [
      `Questions about this policy can be emailed to ${PUBLIC_CONTACT_EMAIL} or sent through the Contact page.`,
    ],
  },
];

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/privacy` },
      { property: "og:image", content: `${SITE_URL}/og-image.png` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/privacy` }],
    scripts: [jsonLdScript(breadcrumbSchema([{ name: "Privacy", path: "/privacy" }]))],
  }),
  component: () => (
    <BuildLegalPage title="Privacy" updated="2026-08-01" sections={PRIVACY_SECTIONS} />
  ),
});
