import { describe, expect, it } from "vitest";
import {
  missionStatusPresentation,
  playbookDisplayName,
  playbookSummaryLabel,
  playbookVersionLabel,
} from "./missionPresentation";

const PUBLISHED_AT = "2026-08-01T10:00:00.000Z";

describe("missionStatusPresentation", () => {
  it("shows Draft for a Mission still being drafted (Playbook also a draft)", () => {
    expect(missionStatusPresentation({ status: "draft", publishedAt: null })).toEqual({
      label: "Draft",
      lifecycle: "draft",
    });
  });

  it("shows Active for a published Mission on a published version", () => {
    expect(missionStatusPresentation({ status: "active", publishedAt: PUBLISHED_AT })).toEqual({
      label: "Active",
      lifecycle: "active",
    });
  });

  it("shows Active for a published Mission whose source version is technically still a draft", () => {
    // The regression this module exists for: the Playbook name carries the
    // word "draft" from generation time, but the Mission is live. The
    // Mission's own status wins.
    const result = missionStatusPresentation({ status: "active", publishedAt: PUBLISHED_AT });
    expect(result.label).toBe("Active");
    expect(result.label).not.toMatch(/draft/i);
  });

  it("shows Paused for an inactive Mission", () => {
    expect(missionStatusPresentation({ status: "paused", publishedAt: PUBLISHED_AT })).toEqual({
      label: "Paused",
      lifecycle: "paused",
    });
  });

  it("shows Archived for an archived Mission", () => {
    expect(missionStatusPresentation({ status: "archived", publishedAt: PUBLISHED_AT }).label).toBe(
      "Archived",
    );
  });

  describe("legacy rows with no explicit status", () => {
    it.each([null, undefined, "", "   "])(
      "falls back to Active when %p but the Mission was published",
      (status) => {
        expect(missionStatusPresentation({ status, publishedAt: PUBLISHED_AT }).label).toBe(
          "Active",
        );
      },
    );

    it.each([null, undefined, ""])(
      "falls back to Draft when %p and the Mission was never published",
      (status) => {
        expect(missionStatusPresentation({ status, publishedAt: null }).label).toBe("Draft");
      },
    );

    it("treats an unrecognised status the same way, rather than echoing it", () => {
      expect(missionStatusPresentation({ status: "weird_state", publishedAt: null }).label).toBe(
        "Draft",
      );
    });

    it("tolerates casing and padding on a known status", () => {
      expect(missionStatusPresentation({ status: " Active " }).label).toBe("Active");
    });
  });
});

describe("playbookDisplayName", () => {
  it.each([
    ["Deck intake — draft v1", "Deck intake"],
    ["Deck intake - draft v12", "Deck intake"],
    ["Deck intake draft v3", "Deck intake"],
    ["Pergola intake — DRAFT V2", "Pergola intake"],
  ])("strips the legacy lifecycle suffix from %s", (input, expected) => {
    expect(playbookDisplayName(input)).toBe(expected);
  });

  it("leaves a clean name untouched", () => {
    expect(playbookDisplayName("Deck Playbook")).toBe("Deck Playbook");
  });

  it("keeps a name that merely contains the word draft elsewhere", () => {
    expect(playbookDisplayName("Draft review intake")).toBe("Draft review intake");
  });

  it("does not strip a version that is not a draft marker", () => {
    expect(playbookDisplayName("Deck intake v2")).toBe("Deck intake v2");
  });

  it.each([null, undefined, "", "   "])("returns null for %p", (input) => {
    expect(playbookDisplayName(input)).toBeNull();
  });

  it("returns null when nothing but the suffix remains", () => {
    expect(playbookDisplayName("draft v1")).toBeNull();
  });

  it("collapses stray whitespace", () => {
    expect(playbookDisplayName("  Deck   intake  ")).toBe("Deck intake");
  });
});

describe("playbookVersionLabel", () => {
  it("formats a real published version number", () => {
    expect(playbookVersionLabel(3)).toBe("v3");
  });

  it.each([null, undefined, 0, -1, Number.NaN])(
    "returns null for %p rather than inventing v1",
    (n) => {
      expect(playbookVersionLabel(n)).toBeNull();
    },
  );
});

describe("playbookSummaryLabel", () => {
  it("separates identity from version instead of merging them into the name", () => {
    expect(playbookSummaryLabel("Deck intake — draft v1", 2)).toBe("Deck intake · v2");
  });

  it("shows the name alone when no published version is known", () => {
    // Better than echoing the draft counter the old string carried.
    expect(playbookSummaryLabel("Deck intake — draft v1", null)).toBe("Deck intake");
  });

  it("falls back to a dash when there is nothing to show", () => {
    expect(playbookSummaryLabel(null, null)).toBe("—");
  });

  it("shows the version alone when the name is unusable", () => {
    expect(playbookSummaryLabel(null, 4)).toBe("v4");
  });
});
