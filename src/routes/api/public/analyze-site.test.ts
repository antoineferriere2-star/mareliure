// The anonymous analysis endpoint is the only place in the product where an
// unauthenticated request can spend money — one LLM call plus one outbound
// fetch per request. These tests exercise the guards that bound that: the
// hourly cap, the duplicate-request claim, and the rule that a failure is
// never dressed up as a result.
import { describe, expect, it, vi } from "vitest";
import { handleAnalyzeSite, hashIp, RATE_LIMIT_MAX, type AnalyzeSiteDeps } from "./analyze-site";

type Row = Record<string, unknown>;

/**
 * Minimal in-memory Supabase double. The real builder is thenable: the count
 * arrives when the whole `.select(head).eq().gte()` chain is awaited, not at
 * `.select()`, so this models the same shape.
 */
function createFakeSupabase(options: { rows?: Row[]; countError?: unknown } = {}) {
  const rows: Row[] = [...(options.rows ?? [])];
  let nextId = 1;

  const from = () => {
    let counting = false;
    let patch: Row | null = null;
    let inserted: Row | null = null;
    const filters: ((r: Row) => boolean)[] = [];
    const matched = () => rows.filter((r) => filters.every((f) => f(r)));

    const api: Record<string, unknown> = {
      select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
        counting = opts?.head === true;
        return api;
      },
      eq: (col: string, val: unknown) => {
        filters.push((r) => r[col] === val);
        return api;
      },
      // created_at is not modelled; the window filter is not what these
      // tests are about.
      gte: () => api,
      insert: (row: Row) => {
        inserted = row;
        return api;
      },
      update: (next: Row) => {
        patch = next;
        return api;
      },
      single: () => {
        const row = inserted!;
        const duplicate = rows.some(
          (r) => r.ip_hash === row.ip_hash && r.request_id === row.request_id,
        );
        if (duplicate) return Promise.resolve({ data: null, error: { code: "23505" } });
        const stored = { ...row, id: `row-${nextId++}` };
        rows.push(stored);
        return Promise.resolve({ data: { id: stored.id }, error: null });
      },
      then: (resolve: (v: unknown) => unknown) => {
        if (counting) {
          return Promise.resolve({
            count: matched().length,
            error: options.countError ?? null,
          }).then(resolve);
        }
        if (patch) matched().forEach((r) => Object.assign(r, patch));
        return Promise.resolve({ error: null }).then(resolve);
      },
    };
    return api;
  };

  return { client: { from } as unknown as AnalyzeSiteDeps["supabase"], rows };
}

const ANALYSIS = {
  businessType: "Pergola installer",
  products: ["Custom pergolas"],
  facts: [
    {
      claim: "Installs pergolas",
      status: "proved" as const,
      sourceQuote: "We install custom pergolas.",
    },
  ],
};

function deps(overrides: Partial<AnalyzeSiteDeps> = {}, supabase?: AnalyzeSiteDeps["supabase"]) {
  return {
    supabase: supabase ?? createFakeSupabase().client,
    fetchSite: async (url: string) => ({ finalUrl: url, html: "<html>pergolas</html>" }),
    analyze: async () => ({ status: "ok" as const, data: ANALYSIS }),
    ...overrides,
  };
}

function post(body: unknown, ip = "203.0.113.7") {
  return new Request("https://metre-pro.com/api/public/analyze-site", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

const validBody = { url: "https://coastalpergolas.com", requestId: "req-abcdefgh" };

describe("a visitor gets the analysis without an account", () => {
  it("returns the business type, products and facts", async () => {
    const res = await handleAnalyzeSite(deps(), post(validBody));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; data: typeof ANALYSIS };
    expect(body.status).toBe("ok");
    expect(body.data.businessType).toBe("Pergola installer");
    expect(body.data.facts[0].sourceQuote).toContain("custom pergolas");
  });

  it("records the analysis with a hashed IP, never the address itself", async () => {
    const fake = createFakeSupabase();
    await handleAnalyzeSite(deps({}, fake.client), post(validBody, "198.51.100.4"));

    const stored = fake.rows[0]!;
    expect(stored.status).toBe("ok");
    expect(stored.ip_hash).toBe(hashIp("198.51.100.4"));
    expect(JSON.stringify(fake.rows)).not.toContain("198.51.100.4");
  });

  it("passes the fetched page to the analysis agent", async () => {
    const analyze = vi.fn(async () => ({ status: "ok" as const, data: ANALYSIS }));
    await handleAnalyzeSite(
      deps({
        fetchSite: async () => ({ finalUrl: "https://x.com", html: "<html>the page</html>" }),
        analyze,
      }),
      post(validBody),
    );
    expect(analyze).toHaveBeenCalledWith("<html>the page</html>");
  });

  it("reports the address the fetch actually landed on, after redirects", async () => {
    const res = await handleAnalyzeSite(
      deps({
        fetchSite: async () => ({ finalUrl: "https://www.coastalpergolas.com/", html: "<html/>" }),
      }),
      post(validBody),
    );
    const body = (await res.json()) as { data: { finalUrl: string } };
    expect(body.data.finalUrl).toBe("https://www.coastalpergolas.com/");
  });
});

describe("bad input is refused before anything is spent", () => {
  it.each([
    ["an empty url", { url: "", requestId: "req-abcdefgh" }],
    ["a missing requestId", { url: "https://example.com" }],
    ["a too-short requestId", { url: "https://example.com", requestId: "short" }],
  ])("rejects %s with 400", async (_label, body) => {
    const analyze = vi.fn();
    const res = await handleAnalyzeSite(deps({ analyze }), post(body));
    expect(res.status).toBe(400);
    expect(analyze).not.toHaveBeenCalled();
  });

  it.each([
    ["localhost", "http://localhost:3000"],
    ["a literal IP", "http://169.254.169.254"],
    ["a non-http scheme", "file:///etc/passwd"],
  ])("rejects %s without reaching the fetcher", async (_label, url) => {
    const fetchSite = vi.fn();
    const res = await handleAnalyzeSite(
      deps({ fetchSite }),
      post({ url, requestId: "req-abcdefgh" }),
    );
    expect(res.status).toBe(400);
    expect(fetchSite).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const req = new Request("https://metre-pro.com/api/public/analyze-site", {
      method: "POST",
      body: "not json",
    });
    expect((await handleAnalyzeSite(deps(), req)).status).toBe(400);
  });
});

describe("spending is bounded", () => {
  it(`refuses request ${RATE_LIMIT_MAX + 1} in the same hour with 429`, async () => {
    const ip = "203.0.113.99";
    const existing = Array.from({ length: RATE_LIMIT_MAX }, (_, i) => ({
      ip_hash: hashIp(ip),
      request_id: `earlier-${i}`,
      status: "ok",
    }));
    const fake = createFakeSupabase({ rows: existing });
    const analyze = vi.fn();

    const res = await handleAnalyzeSite(deps({ analyze }, fake.client), post(validBody, ip));

    expect(res.status).toBe(429);
    expect(analyze).not.toHaveBeenCalled();
    expect(((await res.json()) as { error: string }).error).toContain("create an account");
  });

  it("counts per IP, so one visitor's usage never blocks another", async () => {
    const busy = "203.0.113.99";
    const fresh = "203.0.113.100";
    const fake = createFakeSupabase({
      rows: Array.from({ length: RATE_LIMIT_MAX }, (_, i) => ({
        ip_hash: hashIp(busy),
        request_id: `earlier-${i}`,
        status: "ok",
      })),
    });

    const res = await handleAnalyzeSite(deps({}, fake.client), post(validBody, fresh));
    expect(res.status).toBe(200);
  });

  it("stops rather than failing open when the ledger is unreachable", async () => {
    // The FAQ widget fails open because a missed count costs nothing. Here
    // every request past this point is billable, so an unreadable ledger
    // must not become unlimited free analyses.
    const fake = createFakeSupabase({ countError: { message: "connection refused" } });
    const analyze = vi.fn();

    const res = await handleAnalyzeSite(deps({ analyze }, fake.client), post(validBody));

    expect(res.status).toBe(503);
    expect(analyze).not.toHaveBeenCalled();
  });

  it("refuses a repeated requestId instead of paying for a second analysis", async () => {
    const fake = createFakeSupabase();
    const analyze = vi.fn(async () => ({ status: "ok" as const, data: ANALYSIS }));

    const first = await handleAnalyzeSite(deps({ analyze }, fake.client), post(validBody));
    const second = await handleAnalyzeSite(deps({ analyze }, fake.client), post(validBody));

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(analyze).toHaveBeenCalledTimes(1);
  });
});

describe("a failure is reported as a failure", () => {
  it("returns 400 and records the reason when the site cannot be reached", async () => {
    const fake = createFakeSupabase();
    const res = await handleAnalyzeSite(
      deps(
        {
          fetchSite: async () => {
            throw new Error("DNS lookup failed");
          },
        },
        fake.client,
      ),
      post(validBody),
    );

    expect(res.status).toBe(400);
    expect(fake.rows[0]!.status).toBe("error");
    expect(fake.rows[0]!.error).toContain("DNS lookup failed");
  });

  it("returns 502 rather than inventing an analysis when the agent fails", async () => {
    const fake = createFakeSupabase();
    const res = await handleAnalyzeSite(
      deps(
        { analyze: async () => ({ status: "error" as const, error: "gateway 429" }) },
        fake.client,
      ),
      post(validBody),
    );

    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string; data?: unknown };
    expect(body.data).toBeUndefined();
    expect(fake.rows[0]!.status).toBe("error");
  });

  it("never leaks the internal error text to the visitor", async () => {
    const res = await handleAnalyzeSite(
      deps({
        analyze: async () => ({ status: "error" as const, error: "AI_GATEWAY_KEY invalid" }),
      }),
      post(validBody),
    );
    expect(await res.text()).not.toContain("AI_GATEWAY_KEY");
  });

  it("answers politely when the database client itself cannot be built", async () => {
    // Found in the browser: a missing service-role key made the Supabase
    // client throw on first access, so the visitor got a 500 and a stack
    // instead of the unavailable message.
    const throwing = {
      from: () => {
        throw new Error("Missing Supabase environment variable(s)");
      },
    } as unknown as AnalyzeSiteDeps["supabase"];

    const res = await handleAnalyzeSite(deps({}, throwing), post(validBody));

    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).toContain("unavailable right now");
    expect(text).not.toContain("Supabase");
  });
});
