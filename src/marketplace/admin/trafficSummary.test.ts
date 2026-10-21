import { describe, expect, it } from "vitest";
import { buildTrafficSummary, viewBrand, type PageViewRow } from "./trafficSummary";

const view = (path: string, at: string, session: string, extra: Partial<PageViewRow> = {}): PageViewRow => ({
  path, created_at: at, session_hash: session, visitor_hash: `v-${session}`, referrer_host: null, device: "desktop", is_new_session: false, ...extra,
});

const NOW = "2026-10-21T18:00:00.000Z";
const rows: PageViewRow[] = [
  view("/", "2026-10-20T09:00:00.000Z", "s1", { referrer_host: "www.google.com", is_new_session: true }),
  view("/tarifs", "2026-10-20T09:01:00.000Z", "s1"),
  view("/m/reliure-marketplace-token-000001", "2026-10-20T09:03:00.000Z", "s1"),
  view("/reparation-de-livres", "2026-10-21T10:00:00.000Z", "s2", { device: "mobile", referrer_host: "mareliure.fr" }),
  view("/en", "2026-10-21T11:00:00.000Z", "s3", { referrer_host: "bing.com" }),
  view("/de/book-restoration", "2026-10-21T11:02:00.000Z", "s3"),
  view("/en/project", "2026-10-21T11:05:00.000Z", "s3"),
  // Pages communes ou internes : jamais comptées.
  view("/admin", "2026-10-21T12:00:00.000Z", "s4"),
  view("/auth", "2026-10-21T12:00:00.000Z", "s4"),
  view("/portal", "2026-10-21T12:00:00.000Z", "s4"),
  // Hors période de 7 jours.
  view("/tarifs", "2026-10-01T12:00:00.000Z", "s5"),
];

describe("fréquentation du pilotage", () => {
  it("attribue chaque page à sa marque, et ignore les pages communes ou internes", () => {
    expect(viewBrand("/")).toBe("MA_RELIURE");
    expect(viewBrand("/tarifs?x=1")).toBe("MA_RELIURE");
    expect(viewBrand("/m/reliure-marketplace-token-000001")).toBe("MA_RELIURE");
    expect(viewBrand("/m/fine-bindery-intake-token-000001")).toBe("FINE_BINDERY");
    expect(viewBrand("/en")).toBe("FINE_BINDERY");
    expect(viewBrand("/it/collector-rebinding")).toBe("FINE_BINDERY");
    for (const path of ["/admin", "/auth", "/portal", "/atelier", "/marketplace/binders", "/build"]) expect(viewBrand(path), path).toBeNull();
  });

  it("compte vues, visites, visiteurs et présentations ouvertes, par marque et période", () => {
    const all = buildTrafficSummary(rows, { brand: "ALL", since: "2026-10-14T18:00:00.000Z", days: 7, now: NOW });
    expect(all).toMatchObject({ views: 7, visits: 3, visitors: 3, intakeVisits: 2 });
    const mr = buildTrafficSummary(rows, { brand: "MA_RELIURE", since: "2026-10-14T18:00:00.000Z", days: 7, now: NOW });
    expect(mr).toMatchObject({ views: 4, visits: 2, intakeVisits: 1 });
    const fb = buildTrafficSummary(rows, { brand: "FINE_BINDERY", since: null, days: null, now: NOW });
    expect(fb).toMatchObject({ views: 3, visits: 1, intakeVisits: 1, perDay: [] });
    expect(buildTrafficSummary(rows, { brand: "MA_RELIURE", since: null, days: null, now: NOW }).views).toBe(5);
  });

  it("classe pages, sources (première vue de la visite) et appareils", () => {
    const all = buildTrafficSummary(rows, { brand: "ALL", since: "2026-10-14T18:00:00.000Z", days: 7, now: NOW });
    expect(all.topPages[0]).toEqual({ path: "/", views: 1, visits: 1 });
    expect(all.topPages.map((p) => p.path)).not.toContain("/admin");
    expect(all.sources).toEqual(expect.arrayContaining([
      { source: "google.com", visits: 1 }, { source: "bing.com", visits: 1 }, { source: "Accès direct ou interne", visits: 1 },
    ]));
    expect(all.devices).toEqual([{ device: "desktop", views: 6 }, { device: "mobile", views: 1 }]);
  });

  it("donne un point par jour de la période, jours vides compris", () => {
    const week = buildTrafficSummary(rows, { brand: "ALL", since: "2026-10-14T18:00:00.000Z", days: 7, now: NOW });
    expect(week.perDay).toHaveLength(7);
    expect(week.perDay.at(-1)).toEqual({ day: "2026-10-21", views: 4, visits: 2 });
    expect(week.perDay.at(-2)).toEqual({ day: "2026-10-20", views: 3, visits: 1 });
    expect(week.perDay[0]).toEqual({ day: "2026-10-15", views: 0, visits: 0 });
  });
});
