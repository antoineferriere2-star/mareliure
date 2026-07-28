import * as React from "react";
import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import { template } from "./new-dossier";

const frenchFragments = [
  "Nouveau",
  "Dossier Commercial",
  "Résumé",
  "prochain contact",
  "Ouvrir",
  "Vous recevez",
] as const;

describe("new-dossier email template", () => {
  it("renders native English transactional copy", async () => {
    const html = await render(
      React.createElement(template.component, {
        missionName: "Backyard deck",
        summary: "Complete dossier ready for commercial review.",
        nextQuestions: ["Deck height", "Site access"],
        dossierUrl: "https://metre-pro.com/portal/dossiers/123",
      }),
    );
    const text = await render(
      React.createElement(template.component, {
        missionName: "Backyard deck",
        summary: "Complete dossier ready for commercial review.",
        nextQuestions: ["Deck height", "Site access"],
        dossierUrl: "https://metre-pro.com/portal/dossiers/123",
      }),
      { plainText: true },
    );

    expect(html).toContain('lang="en"');
    expect(text.toLowerCase()).toContain("new project brief");
    expect(text).toContain("Open Project Brief");
    expect(text).toContain("Ask during the next follow-up");
    for (const fragment of frenchFragments) {
      expect(text).not.toContain(fragment);
    }
  });

  it("builds a stable English subject", () => {
    expect(typeof template.subject).toBe("function");
    if (typeof template.subject !== "function") return;

    expect(template.subject({ missionName: "Backyard deck" })).toBe(
      "New Project Brief — Backyard deck",
    );
    expect(template.subject({})).toBe("New Project Brief");
    expect(template.displayName).toBe("New Project Brief");
  });
});
