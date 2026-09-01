import { describe, expect, it } from "vitest";
import { humanizeRawValue, isStatusSummary, resolveDossierTitle } from "./dossierDisplay";

describe("humanizeRawValue", () => {
  it("turns raw stored tokens into readable labels", () => {
    expect(humanizeRawValue("ground_level")).toBe("Ground level");
    expect(humanizeRawValue("composite-decking")).toBe("Composite decking");
    expect(humanizeRawValue("compositeDecking")).toBe("Composite decking");
    expect(humanizeRawValue("not_sure")).toBe("Not sure");
  });

  it("leaves visitor prose untouched", () => {
    const text = "We want a deck off the kitchen, ideally before June.";
    expect(humanizeRawValue(text)).toBe(text);
    expect(humanizeRawValue("12 ft x 16 ft")).toBe("12 ft x 16 ft");
  });

  it("humanizes each entry of a multi-value string", () => {
    expect(humanizeRawValue("ground_level, second_story")).toBe("Ground level, Second story");
  });
});

describe("resolveDossierTitle", () => {
  it("prefers the visitor's project summary", () => {
    expect(
      resolveDossierTitle({
        storedSummary: "Draft dossier — 2 follow-up items pending.",
        projectSummary: "Composite deck, 320 sq ft, ground level.",
        id: "abcdef12-0000-0000-0000-000000000000",
      }),
    ).toBe("Composite deck, 320 sq ft, ground level.");
  });

  it("never titles a brief with a legacy workflow sentence", () => {
    const title = resolveDossierTitle({
      storedSummary: "Complete dossier ready for commercial review.",
      projectSummary: null,
      visitorName: "Dana Reed",
      missionName: "Deck intake",
      id: "abcdef12-0000-0000-0000-000000000000",
    });
    expect(title).toBe("Project Brief — Dana Reed · Deck intake");
    expect(isStatusSummary("Draft dossier — 1 follow-up item pending.")).toBe(true);
  });

  it("falls back to a short id when nothing else is known", () => {
    expect(resolveDossierTitle({ id: "abcdef12-0000-0000-0000-000000000000" })).toBe(
      "Project Brief abcdef12",
    );
  });
});
