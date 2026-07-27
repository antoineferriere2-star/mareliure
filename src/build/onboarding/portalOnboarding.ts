// Pure logic for the client-facing self-service setup under /portal/setup.
// Deliberately free of Supabase, AI and React imports so every rule below is
// unit-testable: URL admissibility, the V1 deck-only product lock, the
// wizard's step machine, branding validation and AI rate limiting.
//
// CLAUDE.md contract enforced here: the AI proposes, the client confirms.
// Nothing in this module ever turns an assumption into a confirmed fact, and
// nothing here publishes anything.

/** V1 is locked to deck builders. No other vertical may be added here. */
export const SUPPORTED_VERTICAL = "deck" as const;

export const ONBOARDING_STATUSES = [
  "started",
  "analyzed",
  "confirmed",
  "draft_ready",
  "published",
] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

/** A single fact the analysis produced, with its provenance. */
export interface AnalysisFact {
  /** What the analysis claims. */
  claim: string;
  /** `proved` = quoted from the fetched page. `assumed` = inference. */
  status: "proved" | "assumed";
  /** Verbatim snippet backing a `proved` fact, when available. */
  sourceQuote?: string;
}

export interface SiteAnalysis {
  finalUrl: string;
  businessType: string;
  isDeckBusiness: boolean;
  deckSignals: string[];
  products: string[];
  facts: AnalysisFact[];
  analyzedAt: string;
}

// ---------------------------------------------------------------- URL input

export type UrlCheck = { ok: true; url: string } | { ok: false; error: string };

/**
 * Client-side admissibility of the website address. This is NOT the security
 * boundary — `fetchSitePublicHtml` (safeFetch.server.ts) still performs DNS
 * resolution and private-range/redirect blocking server-side. This only
 * rejects obviously wrong input early, in English, before an AI call is even
 * considered.
 */
export function checkSiteUrl(raw: string): UrlCheck {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, error: "Enter your website address." };
  if (trimmed.length > 2048) return { ok: false, error: "That address is too long." };

  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { ok: false, error: "That does not look like a valid website address." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Only http:// and https:// addresses are supported." };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: "Remove the credentials from the address." };
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return { ok: false, error: "Enter your public website address." };
  }
  // Literal IP addresses are never a real customer website here, and they are
  // the usual shape of an SSRF probe. safeFetch blocks private ranges anyway;
  // this rejects the whole class earlier with a clearer message.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":") || host.startsWith("[")) {
    return { ok: false, error: "Enter a domain name rather than an IP address." };
  }
  if (!host.includes(".") || host.endsWith(".")) {
    return { ok: false, error: "Enter a full domain, for example yourcompany.com." };
  }

  return { ok: true, url: parsed.toString() };
}

// -------------------------------------------------------- Deck-only product

const DECK_WORDS = [
  "deck",
  "decks",
  "decking",
  "terrasse",
  "terrasses",
  "porch",
  "porches",
  "boardwalk",
];

/** Word-level (not substring) deck detection — "decker" must not match. */
export function hasDeckSignal(text: string): boolean {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .some((word) => DECK_WORDS.includes(word));
}

export type DeckEligibility =
  { eligible: true; suggestedProducts: string[] } | { eligible: false; reason: string };

/**
 * The V1 lock. When the analysed site is not a deck business we say so
 * plainly and stop — we never invent a different funnel, and we never
 * silently downgrade the site into "deck" anyway.
 */
export function resolveDeckEligibility(analysis: {
  businessType: string;
  isDeckBusiness: boolean;
  products: string[];
}): DeckEligibility {
  const deckProducts = analysis.products.filter(hasDeckSignal);
  const signalled =
    analysis.isDeckBusiness || deckProducts.length > 0 || hasDeckSignal(analysis.businessType);

  if (!signalled) {
    return {
      eligible: false,
      reason:
        "We could not find deck or decking work on this website. The current version of Métré Build supports deck businesses only, so there is no setup we can honestly generate for this site yet.",
    };
  }

  // Always offer the canonical deck product, plus whatever deck-specific
  // wording the site itself used (so the client recognises their own words).
  const suggested = ["Deck"];
  for (const product of deckProducts) {
    if (!suggested.some((s) => s.toLowerCase() === product.toLowerCase())) suggested.push(product);
  }
  return { eligible: true, suggestedProducts: suggested.slice(0, 5) };
}

/** A confirmed product must still be a deck product — the lock also applies to free text. */
export function isAcceptableProduct(product: string): boolean {
  return product.trim().length > 0 && product.trim().length <= 80 && hasDeckSignal(product);
}

// ------------------------------------------------------------- Step machine

export const SETUP_STEPS = [
  "website",
  "review",
  "product",
  "customize",
  "preview",
  "publish",
] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export interface OnboardingState {
  status: OnboardingStatus;
  hasAnalysis: boolean;
  hasConfirmedProduct: boolean;
  hasDraft: boolean;
}

/** Where a returning client resumes — the wizard is fully resumable. */
export function resumeStep(state: OnboardingState | null): SetupStep {
  if (!state) return "website";
  if (state.status === "published") return "publish";
  if (state.hasDraft) return "preview";
  if (state.hasConfirmedProduct) return "customize";
  if (state.hasAnalysis) return "review";
  return "website";
}

/** True once publishMyDraft has actually created a live Mission — never inferred, only the stored status. */
export function isPublished(status: OnboardingStatus): boolean {
  return status === "published";
}

// ----------------------------------------------------------------- Branding

export interface Branding {
  displayName: string;
  accentColor: string;
  introTitle: string;
  introText: string;
  ctaLabel: string;
  logoPath: string | null;
}

export const DEFAULT_ACCENT = "#0F172A";

export function defaultBranding(workspaceName: string, product: string): Branding {
  return {
    displayName: workspaceName,
    accentColor: DEFAULT_ACCENT,
    introTitle: `Tell us about your ${product.toLowerCase()} project`,
    introText:
      "A few quick questions so we can prepare an accurate answer before we talk. It takes about 3 minutes.",
    ctaLabel: "Start",
    logoPath: null,
  };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export type BrandingCheck = { ok: true; branding: Branding } | { ok: false; error: string };

/** Light customization only — no access to the technical Playbook editor. */
export function checkBranding(input: Partial<Branding>, fallback: Branding): BrandingCheck {
  const displayName = (input.displayName ?? fallback.displayName).trim();
  if (displayName.length === 0) return { ok: false, error: "Business name cannot be empty." };
  if (displayName.length > 80)
    return { ok: false, error: "Business name is too long (80 characters max)." };

  const accentColor = (input.accentColor ?? fallback.accentColor).trim();
  if (!HEX.test(accentColor))
    return { ok: false, error: "Accent color must be a hex value such as #0F172A." };

  const introTitle = (input.introTitle ?? fallback.introTitle).trim();
  if (introTitle.length === 0) return { ok: false, error: "Title cannot be empty." };
  if (introTitle.length > 120)
    return { ok: false, error: "Title is too long (120 characters max)." };

  const introText = (input.introText ?? fallback.introText).trim();
  if (introText.length > 400)
    return { ok: false, error: "Introduction is too long (400 characters max)." };

  const ctaLabel = (input.ctaLabel ?? fallback.ctaLabel).trim();
  if (ctaLabel.length === 0) return { ok: false, error: "Button label cannot be empty." };
  if (ctaLabel.length > 40)
    return { ok: false, error: "Button label is too long (40 characters max)." };

  const logoPath = input.logoPath === undefined ? fallback.logoPath : input.logoPath;

  return {
    ok: true,
    branding: {
      displayName,
      accentColor,
      introTitle,
      introText,
      ctaLabel,
      logoPath: logoPath ?? null,
    },
  };
}

// -------------------------------------------------------------- AI limiting

/** Per workspace, per action, per hour. Deliberately low: this flow needs 1-2 runs. */
export const AI_RUNS_PER_HOUR = 8;

export interface AiRunRecord {
  requestId: string | null;
  createdAt: string;
}

export type RateDecision =
  | { allow: true }
  | { allow: false; reason: "duplicate" }
  | { allow: false; reason: "rate_limited"; retryAfterMinutes: number };

/**
 * Combined double-click/idempotency and rate check.
 * A repeated `requestId` is a duplicate submit, not a new run: the caller
 * returns the already-stored result instead of paying for a second AI call.
 */
export function checkAiRun(
  recentRuns: AiRunRecord[],
  requestId: string,
  now: Date,
  limit: number = AI_RUNS_PER_HOUR,
): RateDecision {
  if (recentRuns.some((run) => run.requestId === requestId)) {
    return { allow: false, reason: "duplicate" };
  }
  const windowStart = now.getTime() - 60 * 60 * 1000;
  const inWindow = recentRuns.filter((run) => new Date(run.createdAt).getTime() >= windowStart);
  if (inWindow.length >= limit) {
    const oldest = inWindow
      .map((run) => new Date(run.createdAt).getTime())
      .sort((a, b) => a - b)[0];
    const retryAfterMinutes = Math.max(
      1,
      Math.ceil((oldest + 60 * 60 * 1000 - now.getTime()) / 60000),
    );
    return { allow: false, reason: "rate_limited", retryAfterMinutes };
  }
  return { allow: true };
}
