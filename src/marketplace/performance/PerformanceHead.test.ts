import { createElement } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const fixture = vi.hoisted(() => ({
  pathname: "/",
  tags: [] as { tag: string; attrs: Record<string, string>; children?: string }[],
}));
vi.mock("@/brand", () => ({ isMaReliure: true }));
vi.mock("@tanstack/react-router", async () => {
  const { createElement } = await import("react");
  return {
    useRouterState: () => fixture.pathname,
    useRouter: () => ({ options: { ssr: { nonce: "synthetic-csp-nonce" } } }),
    useTags: () => fixture.tags,
    HeadContent: () => createElement("meta", { name: "native-head" }),
    Asset: ({
      tag,
      attrs,
      nonce,
      children,
    }: {
      tag: string;
      attrs: Record<string, string>;
      nonce: string;
      children?: string;
    }) => createElement(tag, { ...attrs, nonce }, children),
  };
});
import { PerformanceHead } from "./PerformanceHead";
beforeEach(() => {
  fixture.pathname = "/";
  fixture.tags = [
    { tag: "meta", attrs: { name: "description", content: "Synthetic public description" } },
    { tag: "link", attrs: { rel: "modulepreload", href: "/assets/index-example.js" } },
    { tag: "link", attrs: { rel: "stylesheet", href: "/assets/styles-example.css" } },
    {
      tag: "link",
      attrs: {
        rel: "preload",
        as: "font",
        href: "/fonts/editorial.woff2",
        crossOrigin: "anonymous",
        fetchPriority: "high",
      },
    },
    { tag: "script", attrs: { type: "application/ld+json" }, children: '{"@type":"WebSite"}' },
  ];
});
describe("public resource priorities without changing document semantics", () => {
  it("discovers critical hints before scripts, retaining CSS, metadata, JSON-LD and CSP nonce", () => {
    const html = renderToStaticMarkup(createElement(PerformanceHead));
    expect(html.indexOf("/fonts/editorial.woff2")).toBeLessThan(
      html.indexOf("/assets/index-example.js"),
    );
    expect(html.indexOf("/assets/styles-example.css")).toBeLessThan(
      html.indexOf("/assets/index-example.js"),
    );
    expect(html).toMatch(/rel="modulepreload"[^>]*fetchPriority="low"/i);
    expect(html).toContain('href="/assets/styles-example.css"');
    expect(html).toContain('content="Synthetic public description"');
    expect(html).toContain('type="application/ld+json" nonce="synthetic-csp-nonce"');
    expect(html).toContain('crossorigin="anonymous"');
    expect(fixture.tags[1].attrs.fetchPriority).toBeUndefined();
  });
  for (const pathname of ["/admin", "/espace-client", "/en/fine-binding", "/une-autre-page"])
    it("keeps native head handling for " + pathname, () => {
      fixture.pathname = pathname;
      expect(renderToStaticMarkup(createElement(PerformanceHead))).toBe(
        '<meta name="native-head"/>',
      );
    });
});
