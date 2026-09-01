// The Hermès read-only gateway: what it exposes, to whom, and from where.
//
// The handler is a plain function over a Request, so authentication and the JSON
// contract are exercised for real; the scope and projection are asserted on the
// source, because they exist to stop a specific thing — a customer's Project
// Intake, or a billing table, leaving through an endpoint made for numbers.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { summariseHermesFunnels } from "./hermesMetrics.server";
import type { ProspectFunnelRow } from "./prospectFunnels.server";
import { handleHermesProspectFunnelMetrics } from "@/routes/api/internal/hermes/prospect-funnels.metrics";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");
}

const route = source("src/routes/api/internal/hermes/prospect-funnels.metrics.ts");
const service = source("src/build/services/hermesMetrics.server.ts");

const URL_BASE = "http://localhost/api/internal/hermes/prospect-funnels/metrics";

function get(token?: string) {
  return new Request(URL_BASE, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

function funnel(over: Partial<ProspectFunnelRow> = {}): ProspectFunnelRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    prospectName: "Spiro Custom Pools",
    companyName: "Spiro Custom Pools",
    domain: "spirocustompools.com",
    websiteUrl: "https://spirocustompools.com",
    status: "ready",
    setupStatus: "published",
    campaignId: "camp-1",
    requestId: "req-12345678",
    lastStep: null,
    lastError: null,
    lastErrorAt: null,
    detectedBusinessType: "pool builder",
    confirmedProduct: "residential pools",
    missionId: "22222222-2222-4222-8222-222222222222",
    missionName: "Pool project intake",
    missionStatus: "published",
    publicToken: "tok",
    publicPath: "/m/tok",
    publicLinkActive: true,
    createdAt: "2026-08-01T10:00:00.000Z",
    createdByEmail: "agent@metre-pro.com",
    lastViewedAt: "2026-08-10T10:00:00.000Z",
    lastActivityAt: "2026-08-10T10:00:00.000Z",
    analyzedAt: "2026-08-01T10:05:00.000Z",
    hasAnalysis: true,
    hasDraft: true,
    issue: null,
    funnel: { viewed: 4, started: 2, completed: 1, briefs: 1 },
    ...over,
  };
}

const ORIGINAL = process.env.HERMES_ADMIN_READ_TOKEN;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.HERMES_ADMIN_READ_TOKEN;
  else process.env.HERMES_ADMIN_READ_TOKEN = ORIGINAL;
});

describe("Hermes metrics endpoint authentication", () => {
  it("rejects a call with no token", async () => {
    process.env.HERMES_ADMIN_READ_TOKEN = "read-token";
    const res = await handleHermesProspectFunnelMetrics(get());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("rejects an invalid token", async () => {
    process.env.HERMES_ADMIN_READ_TOKEN = "read-token";
    const res = await handleHermesProspectFunnelMetrics(get("wrong"));
    expect(res.status).toBe(401);
  });

  it("is invisible when no read token is configured", async () => {
    delete process.env.HERMES_ADMIN_READ_TOKEN;
    const res = await handleHermesProspectFunnelMetrics(get("read-token"));
    expect(res.status).toBe(404);
  });

  it("uses its own secret, not the funnel-creation token", () => {
    expect(route).toContain("process.env.HERMES_ADMIN_READ_TOKEN");
    expect(route).not.toContain("HERMES_PROSPECT_FUNNEL_TOKEN");
  });

  it("answers a machine caller in JSON and never caches an authenticated read", () => {
    expect(route).toContain('"Content-Type": "application/json"');
    expect(route).toContain('"Cache-Control": "no-store"');
  });
});

describe("Hermes metrics scope", () => {
  it("reads only the internal sales workspaces", () => {
    expect(service).toContain("INTERNAL_SALES");
    expect(service).toContain('.eq("workspace_type", INTERNAL_SALES)');
    expect(route).toContain("readHermesFunnelMetrics(sb, parsed.data)");
  });

  it("reuses the existing funnel read instead of querying tables again", () => {
    expect(service).toContain("readProspectDemos");
  });

  it("touches no billing, Stripe or unrelated table", () => {
    for (const forbidden of ["stripe", "Stripe", "build_subscriptions", "billing", "auth.users"]) {
      expect(route).not.toContain(forbidden);
      expect(service).not.toContain(forbidden);
    }
  });

  it("uses no browser automation", () => {
    for (const forbidden of ["Browserbase", "browserbase", "playwright", "puppeteer"]) {
      expect(route).not.toContain(forbidden);
      expect(service).not.toContain(forbidden);
    }
  });

  it("performs no write", () => {
    for (const forbidden of [".insert(", ".update(", ".upsert(", ".delete(", ".rpc("]) {
      expect(route).not.toContain(forbidden);
      expect(service).not.toContain(forbidden);
    }
  });
});

describe("Hermes metrics JSON contract", () => {
  it("returns a stable summary plus funnel list", () => {
    const body = summariseHermesFunnels([
      funnel(),
      funnel({
        id: "33333333-3333-4333-8333-333333333333",
        status: "draft",
        setupStatus: "failed",
        lastStep: "generate",
        lastError: "Model unavailable",
        issue: "Draft generation interrupted — resumes at Your product",
        funnel: { viewed: 0, started: 0, completed: 0, briefs: 0 },
      }),
    ]);
    expect(Object.keys(body).sort()).toEqual(["funnels", "summary"]);
    expect(body.summary).toEqual({
      funnels: 2,
      published: 1,
      failed: 1,
      draft: 1,
      ready: 1,
      sent: 0,
      archived: 0,
      views: 4,
      starts: 2,
      submissions: 1,
      briefs: 1,
    });
    expect(Object.keys(body.funnels[0]!).sort()).toEqual(
      [
        "briefs",
        "campaignId",
        "companyName",
        "createdAt",
        "domain",
        "id",
        "issue",
        "lastActivityAt",
        "lastError",
        "lastErrorAt",
        "lastStep",
        "lastViewedAt",
        "missionId",
        "missionStatus",
        "prospectName",
        "prospectStatus",
        "publicLinkActive",
        "publicPath",
        "requestId",
        "setupStatus",
        "starts",
        "submissions",
        "views",
        "websiteUrl",
      ].sort(),
    );
  });

  it("exposes no internal-only field such as the agent's email or raw token", () => {
    const [row] = summariseHermesFunnels([funnel()]).funnels;
    expect(row).not.toHaveProperty("createdByEmail");
    expect(row).not.toHaveProperty("publicToken");
  });

  it("filters by campaign, status and since, and limits the list only", () => {
    const rows = [
      funnel(),
      funnel({ id: "b", campaignId: "camp-2" }),
      funnel({ id: "c", status: "sent", lastActivityAt: "2026-07-01T00:00:00.000Z" }),
    ];
    expect(summariseHermesFunnels(rows, { campaignId: "camp-2" }).summary.funnels).toBe(1);
    expect(summariseHermesFunnels(rows, { status: "sent" }).funnels[0]!.id).toBe("c");
    expect(summariseHermesFunnels(rows, { since: "2026-08-01T00:00:00.000Z" }).summary.funnels).toBe(
      2,
    );
    const limited = summariseHermesFunnels(rows, { limit: 1 });
    expect(limited.funnels).toHaveLength(1);
    expect(limited.summary.funnels).toBe(3);
  });
});
