import { describe, expect, it } from "vitest";
import { extractSiteText } from "./extractText";

describe("extractSiteText", () => {
  it("extracts the title and meta description", () => {
    const html = `<html><head><title>Sanibel Decks — Deck Builder</title>
      <meta name="description" content="We build decks in Florida."></head><body></body></html>`;
    const result = extractSiteText(html);
    expect(result.title).toBe("Sanibel Decks — Deck Builder");
    expect(result.metaDescription).toBe("We build decks in Florida.");
  });

  it("returns null when title/meta description are absent", () => {
    const result = extractSiteText("<html><body><p>Hello</p></body></html>");
    expect(result.title).toBeNull();
    expect(result.metaDescription).toBeNull();
  });

  it("strips script and style content entirely from the visible text", () => {
    const html = `<html><body>
      <script>window.secret = "should-not-leak";</script>
      <style>.hidden { display: none; content: "also-should-not-leak"; }</style>
      <p>New Deck construction and Composite Decking.</p>
    </body></html>`;
    const result = extractSiteText(html);
    expect(result.visibleText).not.toContain("should-not-leak");
    expect(result.visibleText).not.toContain("also-should-not-leak");
    expect(result.visibleText).toContain("New Deck construction and Composite Decking.");
  });

  it("strips tags, decodes entities and collapses whitespace", () => {
    const html = `<div>New\n\n  Deck   &amp; <b>Deck Replacement</b>&nbsp;services</div>`;
    const result = extractSiteText(html);
    expect(result.visibleText).toBe("New Deck & Deck Replacement services");
  });

  it("truncates very long visible text", () => {
    const html = `<p>${"a".repeat(20000)}</p>`;
    const result = extractSiteText(html);
    expect(result.visibleText.length).toBe(8000);
  });
});
