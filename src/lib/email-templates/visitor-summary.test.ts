import * as React from "react";
import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import { template } from "./visitor-summary";

const baseData = {
  businessName: "Sanibel Decks",
  summary: "New composite deck, roughly 16 ft x 20 ft.",
  confirmedItems: [{ label: "Existing structure", value: "Existing wood deck" }],
  calculatedItems: [{ label: "Approximate area", value: "320 sq ft" }],
  budgetAndTimingItems: [{ label: "Budget", value: "$25,000-$35,000" }],
  itemsToConfirm: [{ label: "Access", value: "Visitor reported access limitations." }],
  nextStep: "Thanks! We'll reach out within 24 hours.",
};

describe("visitor-summary email template", () => {
  it("renders English copy by default", async () => {
    const text = await render(React.createElement(template.component, baseData), {
      plainText: true,
    });
    expect(text.toLowerCase()).toContain("your project summary is ready");
    expect(text).toContain("Sanibel Decks");
    expect(text).toContain("Existing structure");
    expect(text).toContain("Approximate area");
    expect(text).toContain("Access");
    expect(text).toContain("Thanks! We'll reach out within 24 hours.");
    expect(text.toLowerCase()).toContain("not a final quote");
  });

  it("renders Spanish copy when locale is es-US", async () => {
    const html = await render(
      React.createElement(template.component, { ...baseData, locale: "es-US" }),
    );
    const text = await render(
      React.createElement(template.component, { ...baseData, locale: "es-US" }),
      { plainText: true },
    );
    expect(html).toContain('lang="es-US"');
    expect(text.toLowerCase()).toContain("el resumen de su proyecto está listo");
    expect(text).toContain("cotización final");
  });

  it("never renders confidence, suggestedNextAction or any internal-only field name", async () => {
    const text = await render(React.createElement(template.component, baseData), {
      plainText: true,
    });
    expect(text.toLowerCase()).not.toContain("confidence");
    expect(text.toLowerCase()).not.toContain("suggestednextaction");
    expect(text.toLowerCase()).not.toContain("commercial_notes");
    expect(text.toLowerCase()).not.toContain("dossier");
  });

  it("omits the still-to-confirm section entirely when there is nothing to confirm", async () => {
    const text = await render(
      React.createElement(template.component, { ...baseData, itemsToConfirm: [] }),
      { plainText: true },
    );
    expect(text).not.toContain("Still to confirm");
  });

  it("builds a locale-aware subject", () => {
    expect(typeof template.subject).toBe("function");
    if (typeof template.subject !== "function") return;
    expect(template.subject({ locale: "en-US", businessName: "Sanibel Decks" })).toBe(
      "Your project summary from Sanibel Decks",
    );
    expect(template.subject({ locale: "es-US", businessName: "Sanibel Decks" })).toBe(
      "Resumen de su proyecto de Sanibel Decks",
    );
  });
});
