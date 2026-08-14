import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://metre-pro.com";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

// Public, indexable routes only — authenticated (/build, /portal), API,
// visitor-token and demo-session routes are intentionally excluded.
//
// "Indexable" is the whole rule: a page listed here must not carry noindex.
// /demo/deck-project used to sit in this list while serving
// <meta name="robots" content="noindex">, a contradiction Search Console
// reports as "Submitted URL marked noindex". Both halves were individually
// correct, which is why nothing caught it — sitemap.contract.test.ts does now.
const entries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/how-it-works", changefreq: "monthly", priority: "0.8" },
  { path: "/pricing", changefreq: "monthly", priority: "0.8" },
  { path: "/deck-builders", changefreq: "monthly", priority: "0.8" },
  { path: "/example-project-brief", changefreq: "monthly", priority: "0.7" },
  { path: "/free-inquiry-audit", changefreq: "monthly", priority: "0.7" },
  { path: "/private-beta", changefreq: "monthly", priority: "0.7" },
  { path: "/contact", changefreq: "yearly", priority: "0.5" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
];

/**
 * One lastmod for the whole file, resolved at request time.
 *
 * A per-page date would be a lie: nothing in the build tracks when each
 * marketing page last changed, and inventing one per URL is exactly the
 * signal crawlers learn to ignore. The build date is true and useful — it is
 * the last moment any of these pages could have changed.
 */
const LAST_MODIFIED = new Date().toISOString().slice(0, 10);

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            `    <lastmod>${LAST_MODIFIED}</lastmod>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=UTF-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
