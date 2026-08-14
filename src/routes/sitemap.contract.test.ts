// Two invariants that are silent when broken, and that only Search Console
// tells you about, weeks later.
//
// The first one had already been broken: /demo/deck-project was listed in the
// sitemap while serving <meta name="robots" content="noindex">. Nothing in the
// build noticed, because both halves are individually correct.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { faqPageSchema } from "@/lib/structured-data";
import { DECK_BUILDERS_FAQ, PRICING_FAQ } from "@/build/content/publicFaq";

const ROUTES_DIR = join(process.cwd(), "src/routes");

function sitemapSource(): string {
  return readFileSync(join(ROUTES_DIR, "sitemap[.]xml.ts"), "utf8");
}

/** The paths the sitemap declares, read from the source rather than a running server. */
function sitemapPaths(): string[] {
  return [...sitemapSource().matchAll(/path:\s*"([^"]+)"/g)].map((m) => m[1]!);
}

/** Best-effort mapping from a public path to the route file that serves it. */
function routeFileFor(path: string): string | null {
  const flat = path === "/" ? "index" : path.slice(1).replace(/\//g, ".");
  const candidates = readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".tsx"));
  return candidates.find((f) => f === `${flat}.tsx`) ?? null;
}

describe("the sitemap only lists pages we actually want indexed", () => {
  it("lists no page that serves a noindex robots meta", () => {
    const offenders = sitemapPaths().filter((path) => {
      const file = routeFileFor(path);
      if (!file) return false;
      const source = readFileSync(join(ROUTES_DIR, file), "utf8");
      return /name:\s*"robots"[\s\S]{0,80}noindex/.test(source);
    });
    expect(offenders, "sitemap lists a noindex page").toEqual([]);
  });

  it("lists no authenticated, API or visitor-token route", () => {
    const forbidden = /^\/(auth|api|build|portal|m|project-summary)(\/|$)/;
    expect(sitemapPaths().filter((p) => forbidden.test(p))).toEqual([]);
  });

  it("serves XML with an explicit charset", () => {
    // Without it some validators fall back to a different encoding and choke
    // on the accented brand name.
    expect(sitemapSource()).toContain('"application/xml; charset=UTF-8"');
  });

  it("declares a lastmod", () => {
    expect(sitemapSource()).toContain("<lastmod>");
  });
});

describe("FAQ structured data mirrors what the page shows", () => {
  it.each([
    ["deck builders", DECK_BUILDERS_FAQ],
    ["pricing", PRICING_FAQ],
  ])("%s: one Question per visible entry, same text", (_name, entries) => {
    const schema = faqPageSchema(entries);
    expect(schema["@type"]).toBe("FAQPage");
    expect(schema.mainEntity).toHaveLength(entries.length);
    schema.mainEntity.forEach((question, index) => {
      expect(question.name).toBe(entries[index]!.question);
      expect(question.acceptedAnswer.text).toBe(entries[index]!.answer);
    });
  });

  it("both pages render from the same arrays the markup is built from", () => {
    // The guarantee is structural — one array, two consumers — so what this
    // asserts is that nobody has quietly reintroduced a hand-written copy.
    const page = readFileSync(
      join(process.cwd(), "src/build/pages/public/BuildMarketingPages.tsx"),
      "utf8",
    );
    expect(page).toContain("DECK_BUILDERS_FAQ.map(");
    expect(page).toContain("PRICING_FAQ.map(");
  });
});
