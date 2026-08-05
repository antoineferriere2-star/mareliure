/**
 * Which trades Métré Build can actually set up, and how far.
 *
 * The portal used to hardcode `SUPPORTED_VERTICAL = "deck"` and refuse
 * anything else with a message that only made sense for deck businesses. That
 * was accurate — deck is the only Playbook we ship — but it made the limit
 * invisible in the code and impossible to move without touching four files.
 *
 * A vertical's `availability` is a claim about what we can honestly deliver,
 * not a feature flag:
 *
 *   self_service  a real Playbook exists and a client can go from website
 *                 analysis to a published Intake alone. Deck only.
 *   experimental  we recognise the trade well enough to name it, but there is
 *                 no Playbook a client could publish unassisted. Reachable
 *                 through the admin console, where a human is driving.
 *
 * Adding a vertical here does not create a Playbook. Promote one to
 * self_service only once a client can genuinely finish setup without help.
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

export type VerticalEligibility =
  | { eligible: true; vertical: Vertical; suggestedProducts: string[] }
  | { eligible: false; reason: string; identified: Vertical | null };

/**
 * Decides whether the analysed site can go through self-service setup.
 *
 * When it cannot, the message names what we did identify rather than only what
 * we did not find — a pergola installer learning "we could not find deck work"
 * has been told nothing useful about their own business.
 */
export function resolveVerticalEligibility(analysis: {
  businessType: string;
  products: string[];
  /** Legacy hint from the site analysis; treated as one signal among others. */
  isDeckBusiness?: boolean;
}): VerticalEligibility {
  const matchedProducts = analysis.products
    .map((product) => ({ product, vertical: matchVertical(product) }))
    .filter((m): m is { product: string; vertical: Vertical } => m.vertical !== null);

  const selfServiceProducts = matchedProducts.filter(
    (m) => m.vertical.availability === "self_service",
  );
  const fromBusinessType = matchVertical(analysis.businessType);

  const vertical =
    selfServiceProducts[0]?.vertical ??
    (fromBusinessType?.availability === "self_service" ? fromBusinessType : null) ??
    // The analyser's own boolean still counts, but only for the trade it was
    // built to detect.
    (analysis.isDeckBusiness ? (VERTICALS.find((v) => v.id === "deck") ?? null) : null);

  if (vertical && vertical.availability === "self_service") {
    const suggested = [vertical.canonicalProduct];
    for (const { product } of selfServiceProducts) {
      if (!suggested.some((s) => s.toLowerCase() === product.toLowerCase()))
        suggested.push(product);
    }
    return { eligible: true, vertical, suggestedProducts: suggested.slice(0, 5) };
  }

  const identified = matchedProducts[0]?.vertical ?? fromBusinessType ?? null;
  // Prefer the site's own wording: a client recognises "pergola installation"
  // as theirs, where our registry label "pergola" reads as our vocabulary.
  const identifiedText = (
    matchedProducts[0]?.product ??
    analysis.products[0] ??
    analysis.businessType ??
    ""
  ).trim();

  return {
    eligible: false,
    identified,
    reason: identifiedText
      ? `We identified ${identifiedText}. Métré Build currently supports ${selfServiceSummary()} projects in self-service.`
      : `Métré Build currently supports ${selfServiceSummary()} projects in self-service, and we could not identify that work on this website.`,
  };
}

export type ProductCheck = { ok: true; value: string } | { ok: false; error: string };

/** A confirmed product must belong to a self-service vertical — free text included. */
export function checkVerticalProduct(product: string): ProductCheck {
  const trimmed = product.trim();
  if (trimmed.length === 0) return { ok: false, error: "Product cannot be empty." };
  if (trimmed.length > 80) return { ok: false, error: "Product is too long (80 characters max)." };
  if (!isSelfServiceText(trimmed)) {
    return {
      ok: false,
      error: `Métré Build currently supports ${selfServiceSummary()} projects in self-service. Use wording that names that work.`,
    };
  }
  return { ok: true, value: trimmed };
}
