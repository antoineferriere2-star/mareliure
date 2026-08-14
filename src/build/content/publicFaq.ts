/**
 * The question/answer pairs shown on the public marketing pages.
 *
 * They live here rather than inline in the JSX for one reason: the same pairs
 * are rendered on screen *and* emitted as FAQPage structured data. Google
 * treats markup that does not match the visible page as a violation, and two
 * hand-maintained copies drift the first time somebody edits one of them. One
 * array, two consumers.
 *
 * English only, deliberately. These are the source strings; the visible page
 * runs them through `copy()` for the visitor's locale, while the structured
 * data describes the canonical English page Google indexes.
 */
export interface PublicFaqEntry {
  question: string;
  answer: string;
}

export const DECK_BUILDERS_FAQ: PublicFaqEntry[] = [
  {
    question: "Does it produce a final estimate?",
    answer: "No. The demo produces a project brief, not a contractual estimate.",
  },
  {
    question: "Can we use our own questions?",
    answer: "You can customize the journey around your sales process.",
  },
  {
    question: "Does it replace sales?",
    answer: "No. It prepares the first conversation so sales can move faster with better context.",
  },
  {
    question: "Is this self-service?",
    answer:
      "Setup is currently guided - we configure your first Playbook with you, and once published it runs on your site for visitors who choose to start it.",
  },
];

export const PRICING_FAQ: PublicFaqEntry[] = [
  {
    question: "What counts as an active Project Intake?",
    answer:
      "Each Project Intake published on your website counts toward your plan's limit, whether or not it is currently receiving visitors.",
  },
  {
    question: "What counts as a Project Brief?",
    answer:
      "Each completed Project Intake that produces a Project Brief counts once toward your monthly quota, reset every billing cycle.",
  },
  {
    question: "Can I change plans later?",
    answer: "Yes. You can change your plan at any time from your client portal billing page.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "Analyze your website first to see what a Project Brief looks like for your business, with no account required.",
  },
];
