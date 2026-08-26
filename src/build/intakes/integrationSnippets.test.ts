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
    const snippets = buildIntegrationSnippets({
      publicUrl: "/m/tok_123",
      origin: "https://metre-pro.com",
    });
    expect(snippets.publicUrl).toBe("https://metre-pro.com/m/tok_123");
    expect(snippets.linkHtml).toBe(
      '<a href="https://metre-pro.com/m/tok_123">Start your project</a>',
    );
    expect(snippets.iframeHtml).toBe(
      '<iframe\n  src="https://metre-pro.com/m/tok_123"\n  title="Project intake"\n  loading="lazy"\n  width="100%"\n  height="800"\n></iframe>',
    );
  });

  describe("button snippet", () => {
    const button = () =>
      buildIntegrationSnippets({ publicUrl: "/m/tok_123", origin: "https://metre-pro.com" })
        .buttonHtml;

    it("carries its own styling instead of a class we never ship", () => {
      // The customer pastes this into their own site; a `class` we define
      // nowhere renders as a plain link, making the button and link snippets
      // visually identical.
      expect(button()).not.toContain("class=");
      expect(button()).toContain("style=");
    });

    it("looks like a button rather than inheriting the host site's link styles", () => {
      const html = button();
      expect(html).toContain("display:inline-block");
      expect(html).toContain("padding:");
      expect(html).toContain("border-radius:");
      // Without these two the host site's `a { color; text-decoration }` wins.
      expect(html).toContain("text-decoration:none");
      expect(html).toContain("color:#ffffff");
    });

    it("is visually distinguishable from the plain link snippet", () => {
      const snippets = buildIntegrationSnippets({ publicUrl: "/m/tok_123" });
      expect(snippets.buttonHtml).not.toBe(snippets.linkHtml);
      expect(snippets.linkHtml).not.toContain("style=");
    });

    it("applies a valid brand colour", () => {
      const html = buildIntegrationSnippets({
        publicUrl: "/m/tok_123",
        brandColor: "#B91C1C",
      }).buttonHtml;
      expect(html).toContain("background-color:#B91C1C");
    });

    it("ignores a brand colour that tries to smuggle in extra CSS", () => {
      const html = buildIntegrationSnippets({
        publicUrl: "/m/tok_123",
        brandColor: "red;background-image:url(//evil.example)",
      }).buttonHtml;
      expect(html).not.toContain("evil.example");
      expect(html).toContain("background-color:#047857");
    });

    it("ignores a non-hex brand colour rather than emitting invalid CSS", () => {
      const html = buildIntegrationSnippets({
        publicUrl: "/m/tok_123",
        brandColor: "rebeccapurple",
      }).buttonHtml;
      expect(html).toContain("background-color:#047857");
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

describe("the button carries the customer's colour, not ours", () => {
  it("uses the brand colour when one is given", () => {
    // The generator has accepted brandColor since it was written. Nothing ever
    // passed it, so every customer pasted a Métré-green button onto their own
    // site.
    const { buttonHtml } = buildIntegrationSnippets({
      publicUrl: "/m/tok",
      brandColor: "#3d2817",
    });
    expect(buttonHtml).toContain("background-color:#3d2817");
    expect(buttonHtml).not.toContain("#047857");
  });

  it("picks the text colour from the background, never a constant", () => {
    // White on a light brand colour is unreadable, in markup we generated, on
    // a page we do not control.
    const light = buildIntegrationSnippets({ publicUrl: "/m/t", brandColor: "#f5d89f" });
    expect(light.buttonHtml).toContain("color:#000000");

    const dark = buildIntegrationSnippets({ publicUrl: "/m/t", brandColor: "#3d2817" });
    expect(dark.buttonHtml).toContain("color:#ffffff");
  });

  it("keeps the product's green when no colour is given", () => {
    const { buttonHtml } = buildIntegrationSnippets({ publicUrl: "/m/tok" });
    expect(buttonHtml).toContain("background-color:#047857");
    expect(buttonHtml).toContain("color:#ffffff");
  });

  it("still refuses a value that could smuggle in a second declaration", () => {
    const { buttonHtml } = buildIntegrationSnippets({
      publicUrl: "/m/tok",
      brandColor: "red;background-image:url(https://evil.example/x.png)",
    });
    expect(buttonHtml).toContain("background-color:#047857");
    expect(buttonHtml).not.toContain("background-image");
  });
});
