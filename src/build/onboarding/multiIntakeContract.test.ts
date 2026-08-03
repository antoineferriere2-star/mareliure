// Guards the invariants that let a workspace hold several Intakes.
//
// The change removed a UNIQUE constraint that several call sites silently
// depended on, so the risks are structural rather than algorithmic: an upsert
// that no longer has a conflict target, and UPDATEs scoped by workspace_id
// that would now also rewrite published rows. Source-level assertions because
// these are TanStack server functions and a plpgsql function, neither of which
// can be invoked outside a real request or database (same reasoning as
// billingServerContract).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");
}

/**
 * Assertions about what the code *does* must not be satisfiable by a comment
 * that merely mentions the old shape — several comments here deliberately
 * quote it to explain the history.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const onboardingServer = read("src/build/services/portalOnboarding.data.functions.ts");
const onboardingCode = withoutComments(onboardingServer);

function allMigrationsSql(): string {
  const dir = join(process.cwd(), "supabase/migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
}

describe("multi-intake schema", () => {
  it("drops the constraint that allowed only one setup per workspace", () => {
    expect(allMigrationsSql()).toContain(
      "DROP CONSTRAINT IF EXISTS build_workspace_onboarding_workspace_id_key",
    );
  });

  it("still allows only one setup in flight, via a partial unique index", () => {
    const sql = allMigrationsSql();
    expect(sql).toContain("build_workspace_onboarding_one_in_flight_uidx");
    // The WHERE clause is the whole point: without it this is the old
    // constraint again and nothing was gained.
    expect(sql).toMatch(
      /build_workspace_onboarding \(workspace_id\)\s*\n\s*WHERE status <> 'published'/,
    );
  });

  it("publishes the in-flight setup rather than an arbitrary row", () => {
    const sql = allMigrationsSql();
    const publishFn = sql.slice(
      sql.lastIndexOf("CREATE OR REPLACE FUNCTION public.publish_workspace_onboarding"),
    );
    expect(publishFn).toContain("AND status <> 'published'");
  });

  it("keeps the retry path that returns an already-published Mission", () => {
    // Without this fallback a double-clicked publish would raise
    // "Start your setup first" once the row is published.
    const sql = allMigrationsSql();
    const publishFn = sql.slice(
      sql.lastIndexOf("CREATE OR REPLACE FUNCTION public.publish_workspace_onboarding"),
    );
    expect(publishFn).toContain("ORDER BY created_at DESC");
  });

  it("still enforces the plan's active-Mission limit when publishing", () => {
    // The whole point of allowing several Intakes is that the *plan* caps how
    // many may be live — that check must survive.
    const sql = allMigrationsSql();
    const publishFn = sql.slice(
      sql.lastIndexOf("CREATE OR REPLACE FUNCTION public.publish_workspace_onboarding"),
    );
    expect(publishFn).toContain("v_workspace.max_active_missions");
  });
});

describe("multi-intake server layer", () => {
  it("no longer upserts on the dropped conflict target", () => {
    // An upsert whose conflict target no longer exists would insert a new row
    // on every analysis. Matching on the call rather than the bare string, so
    // the comment that explains this history does not satisfy the test.
    expect(onboardingCode).not.toContain(".upsert(");
  });

  it("resolves the analysis write explicitly against the in-flight setup", () => {
    expect(onboardingServer).toContain(
      "const existing = await loadInFlightRow(sb, data.workspaceId)",
    );
  });

  it("scopes every write to a row id, never to the workspace", () => {
    // A write filtered on workspace_id alone would also hit published rows.
    const writeBlocks = onboardingCode.split('.from("build_workspace_onboarding")').slice(1);
    const mutations = writeBlocks.filter((block) => {
      const head = block.slice(0, 400);
      return /\.(update|delete)\(/.test(head);
    });
    expect(mutations.length).toBeGreaterThan(0);
    for (const block of mutations) {
      const head = block.slice(0, 400);
      expect(head, `mutation scoped by workspace_id:\n${head}`).not.toMatch(/\.eq\("workspace_id"/);
      expect(head).toMatch(/\.eq\("id"/);
    }
  });

  it("reads the in-flight setup by excluding published rows", () => {
    expect(onboardingServer).toContain('.neq("status", "published")');
  });

  it("exposes how many Intakes are already published", () => {
    expect(onboardingServer).toContain("publishedIntakeCount");
  });
});
