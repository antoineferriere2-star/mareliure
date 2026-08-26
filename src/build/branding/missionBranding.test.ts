import { describe, expect, it } from "vitest";
import { EMPTY_BRANDING, readMissionBranding, visitorFacingName } from "./missionBranding";

describe("reading a frozen snapshot", () => {
  it("survives everything a jsonb column can hold", () => {
    // It is served on the public runtime, where a malformed row must degrade
    // rather than throw at a visitor.
    for (const value of [null, undefined, {}, [], "text", 42, { displayName: 7 }]) {
      expect(() => readMissionBranding(value)).not.toThrow();
    }
    expect(readMissionBranding({})).toEqual(EMPTY_BRANDING);
    expect(readMissionBranding(null)).toEqual(EMPTY_BRANDING);
  });

  it("reads what the wizard stores", () => {
    const branding = readMissionBranding({
      displayName: "Denver Decks",
      accentColor: "#3D2817",
      introTitle: "Tell us about your deck",
      introText: "Eleven short questions.",
      ctaLabel: "Start my project",
      logoPath: "some/path.png",
    });
    expect(branding.displayName).toBe("Denver Decks");
    expect(branding.accentColor).toBe("#3D2817");
    expect(branding.ctaLabel).toBe("Start my project");
    // logoPath is stored but rendered by nothing; exposing it on the public
    // API would advertise a capability that does not exist.
    expect(branding).not.toHaveProperty("logoPath");
  });

  it("drops a colour that no longer parses", () => {
    // It ends up in a style attribute, and the fallback is a colour we know
    // is safe.
    expect(readMissionBranding({ accentColor: "red;background:url(x)" }).accentColor).toBeNull();
    expect(readMissionBranding({ accentColor: "" }).accentColor).toBeNull();
  });

  it("treats blank strings as absent", () => {
    expect(readMissionBranding({ displayName: "   " }).displayName).toBeNull();
  });
});

describe("the name the visitor sees", () => {
  it("prefers the display name typed for this Intake", () => {
    const branding = readMissionBranding({ displayName: "Denver Decks" });
    expect(visitorFacingName(branding, "Métré Sales / Demos", "whatever")).toBe("Denver Decks");
  });

  it("falls back to the workspace name, as before", () => {
    // Every Intake published before branding was captured must read exactly
    // as it did then.
    expect(visitorFacingName(EMPTY_BRANDING, "Acme Decks", "Acme — Deck Intake")).toBe(
      "Acme Decks",
    );
  });

  it("stops a Sales demo announcing itself as Métré", () => {
    // The bug this whole chain exists to fix: a prospect opening their own
    // personalised demonstration was greeted by our internal workspace name.
    const named = readMissionBranding({ displayName: "KDC Designs" });
    expect(visitorFacingName(named, "Métré Sales / Demos", "x")).toBe("KDC Designs");
    expect(visitorFacingName(EMPTY_BRANDING, "Métré Sales / Demos", "x")).toBe(
      "Métré Sales / Demos",
    );
  });
});
