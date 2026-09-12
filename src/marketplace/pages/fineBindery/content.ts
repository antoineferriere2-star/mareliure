/**
 * Everything the Fine Bindery homepage says, kept separate from the JSX for
 * the same reason as landing/content.ts: a wording fix should not require
 * reading through markup, and the strictest rule on this page — nothing
 * invented (§59, carried over unchanged for the international brand) —
 * is easiest to audit by reading one file. No client count, no rating, no
 * fabricated workshop, no partner logo: if it isn't here, the page can't
 * show it.
 */
import { ARTISANS } from "@/marketplace/pages/landing/content";
import { PHOTOS } from "@/marketplace/pages/landing/photos";

export interface Benefit {
  title: string;
  body: string;
}

export const BENEFITS: readonly Benefit[] = [
  {
    title: "A project, understood",
    body: "You describe your book once. Fine Bindery reviews the work involved before proposing anything.",
  },
  {
    title: "A price you can trust",
    body: "A fixed price when the project can be assessed accurately, or an estimate confirmed before your book is sent.",
  },
  {
    title: "The right French hands",
    body: "Your project goes to the workshop whose skills match it — never a bidding process between workshops.",
  },
  {
    title: "One point of contact, start to finish",
    body: "Your Fine Bindery concierge follows the project from the first photograph to its return home.",
  },
];

export interface Offer {
  title: string;
  body: string;
}

export const OFFERS: readonly Offer[] = [
  {
    title: "Fine Binding",
    body: "Traditional and contemporary bindings in leather, cloth and fine materials.",
  },
  {
    title: "Restoration",
    body: "Careful restoration of old, valuable and meaningful books.",
  },
  {
    title: "Collector Rebinding",
    body: "Transform a favourite or collectible edition into a unique object.",
  },
  {
    title: "Bespoke Commissions",
    body: "One-off bindings, presentation books, family books, boxes and exceptional projects.",
  },
];

export interface HowItWorksStep {
  index: string;
  title: string;
}

export const HOW_IT_WORKS: readonly HowItWorksStep[] = [
  { index: "01", title: "Show us your book" },
  { index: "02", title: "Receive your Fine Bindery proposal" },
  { index: "03", title: "We select the right French workshop" },
  { index: "04", title: "Your book travels to France" },
  { index: "05", title: "Follow the craftsmanship" },
  { index: "06", title: "Receive your book home" },
];

export interface TrustPoint {
  title: string;
}

export const TRUST_POINTS: readonly TrustPoint[] = [
  { title: "Documented condition" },
  { title: "Personal concierge" },
  { title: "Selected French workshop" },
  { title: "Tracked international journey" },
];

export interface FineBinderyFaqItem {
  question: string;
  answer: string;
}

export const FAQ: readonly FineBinderyFaqItem[] = [
  {
    question: "Do I need to speak French?",
    answer: "No. Fine Bindery remains your point of contact throughout the project.",
  },
  {
    question: "Can I contact the bookbinder directly?",
    answer:
      "Fine Bindery manages the project and communication with the selected workshop so that technical decisions, translations and approvals remain properly documented.",
  },
  {
    question: "How is my workshop selected?",
    answer:
      "According to the book, the techniques required, the project's complexity and workshop availability — never through competitive bidding.",
  },
  {
    question: "How much does it cost?",
    answer:
      "Fine Bindery provides a fixed price when the project can be assessed accurately from the information provided. When physical inspection is necessary, we provide an estimate before the book is sent and confirm the final price before work begins.",
  },
  {
    question: "Is shipping included?",
    answer:
      "No. International shipping is quoted separately according to destination, value and level of care required.",
  },
  {
    question: "Can you handle valuable or antique books?",
    answer:
      "Yes, subject to individual review. High-value and heritage books require a dedicated logistics and project assessment before shipment.",
  },
  {
    question: "Where are the workshops?",
    answer: "All Fine Bindery workshops are located in France.",
  },
  {
    question: "Will I have to handle customs paperwork?",
    answer:
      "Fine Bindery prepares the documentation required for the shipment. Any local taxes or duties that may apply will be communicated according to destination and project.",
  },
];

/**
 * The one real workshop already on the platform (see landing/content.ts —
 * ARTISANS is the single source, never duplicated here). Showing it, rather
 * than a placeholder grid, is what §47 asks for: real profiles or none.
 */
export const FEATURED_WORKSHOP = ARTISANS[0];
export { PHOTOS };

/**
 * The workshop's `specialties` are authored in French — correct for
 * ARTISANS' only consumer until now, ReliureLanding.tsx. Translating the
 * five real words it currently holds here rather than inventing an English
 * ARTISANS list of its own: same fact, same source, worded for this
 * reader.
 */
const SPECIALTY_TRANSLATIONS: Record<string, string> = {
  Reliure: "Bookbinding",
  Restauration: "Restoration",
  Dorure: "Gilding",
  Cartonnage: "Box-making",
  "Pose de cuir": "Leather work",
};

export function englishSpecialty(specialty: string): string {
  return SPECIALTY_TRANSLATIONS[specialty] ?? specialty;
}
