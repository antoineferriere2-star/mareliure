import { describe, expect, it } from "vitest";

import {
  INTAKE_STEPS,
  defaultIntakeTitle,
  escapeHtml,
  hostLabel,
  renderPreviewHtml,
} from "./template";

const base = {
  company: "Spiro Custom Pools",
  url: "https://www.spirocustompools.com/quote",
  vertical: "residential pools",
  primaryColor: "#045b9b",
};

describe("prospect preview template", () => {
  it("renders the concept preview header and both panels", () => {
    const html = renderPreviewHtml(base);
    expect(html).toContain("Concept preview");
    expect(html).toContain("Spiro Custom Pools today");
    expect(html).toContain("With a Métré Project Intake");
  });

  it("renders the Website → Project Intake → Project Brief footer", () => {
    const html = renderPreviewHtml(base);
    expect(html).toContain(">Website<");
    expect(html).toContain(">Project Intake<");
    expect(html).toContain(">Project Brief<");
  });

  it("uses the provided intake title, otherwise the vertical default", () => {
    expect(renderPreviewHtml({ ...base, intakeTitle: "Tell us about your pool" })).toContain(
      "Tell us about your pool",
    );
    expect(renderPreviewHtml(base)).toContain(defaultIntakeTitle(base.vertical));
  });

  it("applies the primary color to accents", () => {
    expect(renderPreviewHtml(base)).toContain("#045b9b");
  });

  it("lists every intake step", () => {
    const html = renderPreviewHtml(base);
    for (const step of INTAKE_STEPS) expect(html).toContain(escapeHtml(step));
  });

  it("falls back to a placeholder panel when the capture failed", () => {
    const html = renderPreviewHtml({ ...base, siteImage: null });
    expect(html).toContain("Website preview unavailable");
    expect(html).not.toContain("<img src=\"data:image/png");
  });

  it("embeds the capture when it succeeded", () => {
    const html = renderPreviewHtml({ ...base, siteImage: "data:image/png;base64,AAA" });
    expect(html).toContain("data:image/png;base64,AAA");
    expect(html).not.toContain("Website preview unavailable");
  });

  it("shows a clean host in the browser bar", () => {
    expect(hostLabel(base.url)).toBe("spirocustompools.com");
    expect(hostLabel("not a url")).toBe("not a url");
  });

  it("escapes prospect-provided text", () => {
    const html = renderPreviewHtml({ ...base, company: '<script>"x"' });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("never mentions forbidden vocabulary", () => {
    const html = renderPreviewHtml(base).toLowerCase();
    for (const word of ["lead", "questionnaire", "formulaire"]) {
      expect(html).not.toContain(word);
    }
  });
});
