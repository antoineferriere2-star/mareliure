/**
 * Which trades Métré Build recognises by name, and how mature each one is.
 *
 * This registry is descriptive, never a gate. Self-service setup generates a
 * Playbook for whatever product the client confirms, including trades absent
 * from this list — see `checkProduct` in src/build/onboarding/portalOnboarding.ts.
 *
 *   self_service  a hand-written Playbook exists and has been used in
 *                 production. Deck only.
 *   experimental  recognised well enough to name, but the Playbook a client
 *                 gets is AI-generated rather than curated.
 *
 * Adding a vertical here does not create a Playbook, and omitting one does not
 * block a client.
 */

export type VerticalAvailability = "self_service" | "experimental";

export interface Vertical {
  id: string;
  /** How the trade is named to a client. */
  label: string;
  availability: VerticalAvailability;
  /**
   * Whole words that identify the trade. Matching is word-level, never
   * substring: "decker" (a surname, or Decker Roofing) must not read as deck.
   */
  keywords: string[];
  /** Offered first in the product suggestions, so the client sees our wording. */
  canonicalProduct: string;
}

export const VERTICALS: readonly Vertical[] = [
  {
    id: "deck",
    label: "Deck",
    availability: "self_service",
    keywords: [
      "deck",
      "decks",
      "decking",
      "terrasse",
      "terrasses",
      "porch",
      "porches",
      "boardwalk",
    ],
    canonicalProduct: "Deck",
  },
  // Recognised so we can name what we found and say plainly that it is not
  // self-service yet — better than "we could not find deck work", which reads
  // as if the analysis failed.
  {
    id: "pergola",
    label: "Pergola",
    availability: "experimental",
    keywords: ["pergola", "pergolas", "arbor", "arbour", "gazebo", "gazebos"],
    canonicalProduct: "Pergola",
  },
  {
    id: "patio",
    label: "Patio",
    availability: "experimental",
    keywords: ["patio", "patios", "hardscape", "hardscaping", "paver", "pavers"],
    canonicalProduct: "Patio",
  },
  {
    id: "fence",
    label: "Fence",
    availability: "experimental",
    keywords: ["fence", "fences", "fencing", "railing", "railings"],
    canonicalProduct: "Fence",
  },
];

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/);
}

/** The first vertical whose keywords appear as whole words, or null. */
export function matchVertical(text: string): Vertical | null {
  const found = words(text);
  return VERTICALS.find((v) => v.keywords.some((k) => found.includes(k))) ?? null;
}

export function selfServiceVerticals(): Vertical[] {
  return VERTICALS.filter((v) => v.availability === "self_service");
}

export function isSelfServiceText(text: string): boolean {
  return matchVertical(text)?.availability === "self_service";
}

/** "deck", or "deck or pergola" once a second trade ships. */
export function selfServiceSummary(): string {
  const labels = selfServiceVerticals().map((v) => v.label.toLowerCase());
  if (labels.length === 0) return "no";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
}
