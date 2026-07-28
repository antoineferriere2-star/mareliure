import { describe, expect, it } from "vitest";
import { buildIntegrationSnippets, toAbsolutePublicUrl } from "./integrationSnippets";

describe("toAbsolutePublicUrl", () => {
  it("keeps absolute URLs and expands public paths with the current origin", () => {
    expect(toAbsolutePublicUrl("https://example.com/m/token", "https://metre-pro.com")).toBe(
      "https://example.com/m/token",
    );
    expect(toAbsolutePublicUrl("/m/token", "https://metre-pro.com/")).toBe(
      "https://metre-pro.com/m/token",
    );
    expect(toAbsolutePublicUrl("m/token", "https://metre-pro.com")).toBe(
      "https://metre-pro.com/m/token",
    );
  });
});

describe("buildIntegrationSnippets", () => {
  it("generates one shared direct URL, link, button, and iframe", () => {
    expect(
      buildIntegrationSnippets({
        publicUrl: "/m/tok_123",
        origin: "https://metre-pro.com",
      }),
    ).toEqual({
      publicUrl: "https://metre-pro.com/m/tok_123",
      linkHtml: '<a href="https://metre-pro.com/m/tok_123">Start your project</a>',
      buttonHtml:
        '<a href="https://metre-pro.com/m/tok_123" class="metre-build-button">\n  Start your project\n</a>',
      iframeHtml:
        '<iframe\n  src="https://metre-pro.com/m/tok_123"\n  title="Project intake"\n  loading="lazy"\n  width="100%"\n  height="800"\n></iframe>',
    });
  });

  it("escapes labels and clamps iframe height", () => {
    const snippets = buildIntegrationSnippets({
      publicUrl: '/m/a"b',
      origin: "https://metre-pro.com",
      ctaLabel: 'Start <now> "please"',
      iframeTitle: 'Deck "quote"',
      iframeHeight: 10,
    });
    expect(snippets.linkHtml).toContain("Start &lt;now&gt; &quot;please&quot;");
    expect(snippets.buttonHtml).toContain('href="https://metre-pro.com/m/a&quot;b"');
    expect(snippets.iframeHtml).toContain('title="Deck &quot;quote&quot;"');
    expect(snippets.iframeHtml).toContain('height="320"');
  });
});
