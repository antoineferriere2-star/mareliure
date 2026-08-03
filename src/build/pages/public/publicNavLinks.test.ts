// Every internal link in the shared public header/footer must resolve to a
// real route file.
//
// An audit reported /example-brief and /free-audit as broken. Neither string
// exists in this repo, and production serves the correct paths — so the
// finding was not reproducible. This test is the guard that makes that
// verifiable from now on: rename a route and forget a link, and it fails here
// instead of in someone's browser.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROUTES_DIR = join(process.cwd(), "src/routes");

/** Public paths served by something other than a file in src/routes. */
const NON_FILE_ROUTES = new Set(["/"]);

function routeFileToPath(fileName: string): string {
  const base = fileName.replace(/\.tsx?$/, "");
  if (base === "index") return "/";
  // TanStack file routes use "." as the path separator: demo.deck-project.
  return `/${base.split(".").join("/")}`;
}

function knownRoutePaths(): Set<string> {
  const paths = new Set(NON_FILE_ROUTES);
  for (const entry of readdirSync(ROUTES_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
    if (entry.name.startsWith("__")) continue;
    if (entry.name.startsWith("_")) continue; // layout routes, not addressable
    paths.add(routeFileToPath(entry.name));
  }
  return paths;
}

/** Internal hrefs / `to=` targets declared in the shared public chrome. */
function publicChromeLinks(): string[] {
  const shell = readFileSync(
    join(process.cwd(), "src/build/pages/public/BuildPublicShell.tsx"),
    "utf8",
  );
  const links = new Set<string>();
  for (const match of shell.matchAll(/(?:href|to)="(\/[^"]*)"/g)) links.add(match[1]);
  return [...links];
}

describe("public header and footer links", () => {
  it("finds links to check", () => {
    // Guards the regex: an empty list would make this file pass forever.
    expect(publicChromeLinks().length).toBeGreaterThan(5);
  });

  it("points every internal link at a real route", () => {
    const routes = knownRoutePaths();
    for (const link of publicChromeLinks()) {
      // Dynamic segments are exercised by the runtime E2E, not here.
      const path = link.split("?")[0].split("#")[0];
      if (path.includes("$")) continue;
      expect(routes.has(path), `No route file serves "${path}"`).toBe(true);
    }
  });

  it("does not reference the paths the audit reported as broken", () => {
    const links = publicChromeLinks();
    expect(links).not.toContain("/example-brief");
    expect(links).not.toContain("/free-audit");
    // …and does reference the real ones, so this stays meaningful.
    expect(links).toContain("/example-project-brief");
    expect(links).toContain("/free-inquiry-audit");
  });
});
