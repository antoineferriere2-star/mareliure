// The fallback exists to turn an outage into a lead. What matters is that it
// fires for OUR failures and never for the visitor's, and that it does not
// depend on the thing that is down.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");
}

const page = source("src/build/pages/public/BuildFreeInquiryAuditPage.tsx");
const fallback = source("src/build/pages/public/AnalysisUnavailableFallback.tsx");
const endpoint = source("src/routes/api/public/analyze-site.ts");

describe("who the fallback is offered to", () => {
  it("fires on 503 — the analyser being down is ours to own", () => {
    expect(page).toContain("res.status === 503");
    expect(page).toContain('setStatus("unavailable")');
  });

  it("fires when the request never completes", () => {
    // Indistinguishable from an outage from the browser, and the visitor did
    // nothing wrong either way.
    const cat = page.slice(page.indexOf("} catch {"));
    expect(cat.slice(0, 400)).toContain('setStatus("unavailable")');
  });

  it("never fires on a bad URL or a spent allowance", () => {
    // 400 means the visitor's own address could not be reached; 429 means they
    // have already had their analyses. Asking for an email to fix a typo would
    // be a dark pattern, and both already carry a message that says what to do.
    expect(page).not.toContain("res.status === 400");
    expect(page).not.toContain("res.status === 429");
    // The 503 branch must be the only route into the fallback state.
    expect(page.match(/setStatus\("unavailable"\)/g) ?? []).toHaveLength(2);
  });

  it("only 503 carries the outage message on the server", () => {
    // If a future edit returned UNAVAILABLE with a different status, the page
    // would silently stop offering the fallback.
    const unavailableStatuses = [
      ...endpoint.matchAll(/json\((\d{3}), \{ error: UNAVAILABLE \}\)/g),
    ].map((m) => m[1]);
    expect(unavailableStatuses.length).toBeGreaterThan(0);
    expect(new Set(unavailableStatuses)).toEqual(new Set(["503"]));
  });
});

describe("the fallback does not depend on what is broken", () => {
  it("posts to the public intake, not to the analyser", () => {
    // build_public_requests is a different table from the analysis ledger.
    // Routing the fallback through the endpoint that just failed would make it
    // fail too.
    expect(fallback).toContain("/api/public/build-public-intake");
    expect(fallback).not.toContain("/api/public/analyze-site");
    expect(fallback).toContain('type: "audit"');
  });

  it("reuses the address the visitor already typed", () => {
    expect(fallback).toContain("checkSiteUrl(websiteUrl)");
  });

  it("carries the honeypot the other public forms use", () => {
    expect(fallback).toContain('name="website"');
    expect(fallback).toContain("website: honeypot");
  });

  it("asks for consent explicitly", () => {
    // The endpoint requires consent: true; collecting an address without it
    // would fail server-side anyway, and should never be attempted.
    expect(fallback).toContain("consent");
    expect(fallback).toContain('type="checkbox"');
  });
});
