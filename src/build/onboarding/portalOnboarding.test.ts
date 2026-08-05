import { describe, expect, it } from "vitest";
import {
  AI_RUNS_PER_HOUR,
  checkAiRun,
  checkBranding,
  checkBusinessType,
  checkProduct,
  checkSiteUrl,
  defaultBranding,
  isPublished,
  resumeStep,
} from "./portalOnboarding";

describe("checkSiteUrl", () => {
  it("accepts a bare domain and normalizes it to https", () => {
    const result = checkSiteUrl("  sanibeldecks.com ");
    expect(result).toEqual({ ok: true, url: "https://sanibeldecks.com/" });
  });

  it("accepts explicit http and https", () => {
    expect(checkSiteUrl("http://example.com").ok).toBe(true);
    expect(checkSiteUrl("https://example.com/decks").ok).toBe(true);
  });

  it.each([
    ["", "Enter your website address."],
    ["not a url", "That does not look like a valid website address."],
    ["https://no-tld-here", "Enter a full domain, for example yourcompany.com."],

    ["ftp://example.com", "Only http:// and https:// addresses are supported."],
    ["file:///etc/passwd", "Only http:// and https:// addresses are supported."],
    ["http://localhost:8080", "Enter your public website address."],
    ["http://router.local", "Enter your public website address."],
    ["http://127.0.0.1", "Enter a domain name rather than an IP address."],
    ["http://169.254.169.254/latest/meta-data", "Enter a domain name rather than an IP address."],
    ["http://10.0.0.5", "Enter a domain name rather than an IP address."],
    ["http://[::1]/", "Enter a domain name rather than an IP address."],
    ["https://user:pass@example.com", "Remove the credentials from the address."],
  ])("rejects %s", (input, error) => {
    expect(checkSiteUrl(input)).toEqual({ ok: false, error });
  });

  it("rejects an absurdly long address", () => {
    expect(checkSiteUrl(`https://example.com/${"a".repeat(3000)}`).ok).toBe(false);
  });
});

describe("confirmation text checks", () => {
  it("lets the client correct the detected business type", () => {
    expect(checkBusinessType("  Outdoor living / deck builder  ")).toEqual({
      ok: true,
      value: "Outdoor living / deck builder",
    });
  });

  it.each([
    ["", "Business type cannot be empty."],
    ["x".repeat(81), "Business type is too long (80 characters max)."],
  ])("rejects invalid business type %s", (input, error) => {
    expect(checkBusinessType(input)).toEqual({ ok: false, error });
  });
});

describe("checkProduct", () => {
  it("accepts any trade, not only the ones we ship a hand-written Playbook for", () => {
    // The portal used to refuse anything that was not deck work. The draft
    // generator builds a Playbook for any product, so that refusal turned
    // clients away from a system that could already serve them.
    for (const product of ["Deck", "Pergola", "Swimming pool", "Kitchen remodel"]) {
      expect(checkProduct(product)).toEqual({ ok: true, value: product });
    }
  });

  it("trims surrounding whitespace", () => {
    expect(checkProduct("  Composite deck resurfacing  ")).toEqual({
      ok: true,
      value: "Composite deck resurfacing",
    });
  });

  it.each([
    [" ", "Product cannot be empty."],
    ["x".repeat(81), "Product is too long (80 characters max)."],
  ])("rejects %s", (input, error) => {
    expect(checkProduct(input)).toEqual({ ok: false, error });
  });

  it("accepts exactly 80 characters", () => {
    expect(checkProduct("x".repeat(80)).ok).toBe(true);
  });
});

describe("resumeStep", () => {
  it("starts at the website step for a brand new workspace", () => {
    expect(resumeStep(null)).toBe("website");
  });

  it("resumes exactly where the client stopped", () => {
    expect(
      resumeStep({
        status: "analyzed",
        hasAnalysis: true,
        hasConfirmedProduct: false,
        hasDraft: false,
      }),
    ).toBe("review");
    expect(
      resumeStep({
        status: "confirmed",
        hasAnalysis: true,
        hasConfirmedProduct: true,
        hasDraft: false,
      }),
    ).toBe("customize");
    expect(
      resumeStep({
        status: "draft_ready",
        hasAnalysis: true,
        hasConfirmedProduct: true,
        hasDraft: true,
      }),
    ).toBe("preview");
  });

  it("resumes to the publish screen once published, even with a stale draft flag", () => {
    expect(
      resumeStep({
        status: "published",
        hasAnalysis: true,
        hasConfirmedProduct: true,
        hasDraft: true,
      }),
    ).toBe("publish");
  });
});

describe("isPublished", () => {
  it("is true only for the published status", () => {
    expect(isPublished("published")).toBe(true);
    expect(isPublished("draft_ready")).toBe(false);
    expect(isPublished("started")).toBe(false);
  });
});

describe("checkBranding", () => {
  const fallback = defaultBranding("Sanibel Decks", "Deck");

  it("builds sane defaults from the workspace name", () => {
    expect(fallback.displayName).toBe("Sanibel Decks");
    expect(fallback.introTitle).toContain("deck");
    expect(fallback.logoPath).toBeNull();
  });

  it("trims and accepts a valid customization", () => {
    const result = checkBranding(
      { displayName: "  Sanibel Decks LLC ", accentColor: "#B45309", ctaLabel: "Start my project" },
      fallback,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.branding.displayName).toBe("Sanibel Decks LLC");
      expect(result.branding.accentColor).toBe("#B45309");
      expect(result.branding.introTitle).toBe(fallback.introTitle);
    }
  });

  it.each([
    [{ displayName: "" }, "Business name cannot be empty."],
    [{ accentColor: "red" }, "Accent color must be a hex value such as #0F172A."],
    [{ accentColor: "#FFF" }, "Accent color must be a hex value such as #0F172A."],
    [{ introTitle: "" }, "Title cannot be empty."],
    [{ ctaLabel: "" }, "Button label cannot be empty."],
    [{ introText: "x".repeat(401) }, "Introduction is too long (400 characters max)."],
  ])("rejects invalid customization %o", (input, error) => {
    expect(checkBranding(input, fallback)).toEqual({ ok: false, error });
  });
});

describe("checkAiRun", () => {
  const now = new Date("2026-07-27T12:00:00Z");

  it("allows a first run", () => {
    expect(checkAiRun([], "req-1", now)).toEqual({ allow: true });
  });

  it("treats a repeated request id as a duplicate submit, not a new run", () => {
    const runs = [{ requestId: "req-1", createdAt: "2026-07-27T11:59:58Z" }];
    expect(checkAiRun(runs, "req-1", now)).toEqual({ allow: false, reason: "duplicate" });
    expect(checkAiRun(runs, "req-2", now)).toEqual({ allow: true });
  });

  it("rate limits per hour and tells the client when to retry", () => {
    const runs = Array.from({ length: AI_RUNS_PER_HOUR }, (_, i) => ({
      requestId: `req-${i}`,
      createdAt: "2026-07-27T11:30:00Z",
    }));
    const decision = checkAiRun(runs, "req-new", now);
    expect(decision.allow).toBe(false);
    if (!decision.allow && decision.reason === "rate_limited") {
      expect(decision.retryAfterMinutes).toBe(30);
    }
  });

  it("ignores runs older than the window", () => {
    const runs = Array.from({ length: AI_RUNS_PER_HOUR }, (_, i) => ({
      requestId: `old-${i}`,
      createdAt: "2026-07-27T09:00:00Z",
    }));
    expect(checkAiRun(runs, "req-new", now)).toEqual({ allow: true });
  });
});
