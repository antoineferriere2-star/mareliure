// The permission shape of Métré Sales / Demos.
//
// These are TanStack server functions wrapped in HTTP/auth middleware, so they
// cannot be invoked outside a real request — same reasoning as
// teamContract.test.ts. What is asserted here is the shape of the guards,
// because each one exists to stop a specific thing: the sales agent reaching
// another workspace, reaching Stripe, or a customer reaching the prospect list.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");
}

const salesDemos = source("src/build/services/salesDemos.data.functions.ts");
const billing = source("src/build/services/billing.data.functions.ts");
const portal = source("src/build/services/portal.data.functions.ts");
const entitlements = source("src/build/billing/entitlements.ts");
const adminFns = source("src/build/services/admin.data.functions.ts");

/** The body of one exported server function, up to the next export. */
function serverFn(text: string, name: string): string {
  const start = text.indexOf(`export const ${name} = createServerFn`);
  expect(start, `${name} is not exported`).toBeGreaterThanOrEqual(0);
  const next = text.indexOf("\nexport const ", start + 1);
  return text.slice(start, next === -1 ? undefined : next);
}

function indexOfIn(text: string, fragment: string): number {
  const index = text.indexOf(fragment);
  expect(index, `Missing: ${fragment}`).toBeGreaterThanOrEqual(0);
  return index;
}

const DEMO_FNS = ["listProspectDemos", "updateProspectDemo"] as const;

describe("the sales agent cannot reach another workspace", () => {
  it.each(DEMO_FNS)("%s proves membership before touching the service-role client", (name) => {
    // The service-role client bypasses RLS entirely. `workspaceId` arrives in
    // the request body, so it is only trustworthy after assertWorkspace* has
    // checked it against the caller's OWN RLS-scoped client.
    const fn = serverFn(salesDemos, name);
    const authorization = Math.max(fn.indexOf("assertWorkspace"), 0);
    expect(authorization, `${name}: admin() before authorization`).toBeLessThan(
      indexOfIn(fn, "await admin()"),
    );
  });

  it("writing a demo is owner-only, reading it is open to any member", () => {
    expect(serverFn(salesDemos, "updateProspectDemo")).toContain("assertWorkspaceOwner(");
    expect(serverFn(salesDemos, "listProspectDemos")).toContain("assertWorkspaceMember(");
  });

  it("re-checks the demo id against the named workspace before writing", () => {
    // demoId comes from the browser. Without this, an owner of one workspace
    // could rename or archive a row belonging to another.
    expect(serverFn(salesDemos, "updateProspectDemo")).toContain(
      "demo.workspace_id !== data.workspaceId",
    );
  });

  it("never describes a Mission that is not this workspace's", () => {
    expect(serverFn(salesDemos, "listProspectDemos")).toContain(
      '.eq("workspace_id", data.workspaceId)',
    );
  });
});

describe("the prospect list exists only for an internal workspace", () => {
  it.each(DEMO_FNS)("%s refuses a customer workspace", (name) => {
    expect(serverFn(salesDemos, name)).toContain("assertInternalSalesWorkspace(");
  });

  it("answers 404 rather than 403", () => {
    // 403 would confirm the surface exists and is merely forbidden. For a
    // customer account it does not exist at all.
    expect(salesDemos).toContain('fail(404, "Not found.")');
  });
});

describe("the sales agent cannot reach Stripe", () => {
  // The agent has to be an `owner` to run the setup wizard at all, and owner
  // is exactly what the billing functions check — so role alone cannot keep
  // them out. The workspace type has to.
  it.each(["createWorkspaceCheckoutSession", "createWorkspaceBillingPortalSession"])(
    "%s is closed on an internal workspace",
    (name) => {
      expect(serverFn(billing, name)).toContain("assertBillingSurface(");
    },
  );

  it("the billing summary is closed too", () => {
    expect(serverFn(portal, "getMyWorkspaceBilling")).toContain("assertBillingSurface(");
  });

  it("checks the workspace type, never the workspace name", () => {
    // A name is editable free text: branching on it would let a rename move a
    // customer out of billing, or an internal workspace into it. Mentioning
    // the name in prose is fine — comparing against it is not.
    const guards = [
      source("src/build/services/workspaceEntitlements.server.ts"),
      salesDemos,
      source("src/build/workspaces/internalSales.ts"),
    ];
    for (const guard of guards) {
      const code = guard.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(code).not.toMatch(/\bname\b\s*===/);
      expect(code).not.toContain('.eq("name"');
    }
    expect(guards[0]).toContain("isInternalSales(workspace.workspace_type)");
  });
});

describe("billing exemption is decided in one place", () => {
  it("resolves an internal workspace before any subscription rule", () => {
    // Placed first on purpose: a stray trial_ends_at or provisioned_for_user_id
    // on the row must not be able to pull our own workspace into the funnel.
    const resolver = entitlements.slice(
      entitlements.indexOf("export function resolveEntitlements"),
    );
    const internal = indexOfIn(resolver, "isInternalSales(input.workspaceType)");
    expect(internal).toBeLessThan(indexOfIn(resolver, "input.provisionedForUserId === null"));
    expect(internal).toBeLessThan(indexOfIn(resolver, "ACTIVE_STRIPE_STATUSES.has(status)"));
  });

  it("still lets the operator kill switch win", () => {
    // is_active = false must disable an internal workspace like any other.
    const resolver = entitlements.slice(
      entitlements.indexOf("export function resolveEntitlements"),
    );
    expect(resolver.indexOf("!input.isActive")).toBeLessThan(
      indexOfIn(resolver, "isInternalSales(input.workspaceType)"),
    );
  });

  it("reads workspace_type from the database", () => {
    expect(source("src/build/services/workspaceEntitlements.server.ts")).toContain(
      "workspaceType: workspace.workspace_type",
    );
  });
});

describe("a customer workspace is unaffected", () => {
  it("adds members as plain members unless an owner is asked for explicitly", () => {
    // Least privilege by default: the role is optional and falls back to
    // "member", so existing admin flows keep their old behaviour exactly.
    expect(serverFn(adminFns, "addWorkspaceMember")).toContain('data.role ?? "member"');
  });

  it("creates client workspaces unless a type is asked for explicitly", () => {
    expect(serverFn(adminFns, "createWorkspace")).toContain('data.workspaceType ?? "client"');
  });

  it("gives an internal workspace its headroom in columns, not in code", () => {
    // max_active_missions / monthly_brief_quota stay ordinary columns the
    // operator can see and change — exactly like an Enterprise deal. No
    // branch anywhere skips the quota check.
    const fn = serverFn(adminFns, "createWorkspace");
    expect(fn).toContain("INTERNAL_SALES_ACTIVE_MISSIONS");
    expect(fn).toContain("INTERNAL_SALES_MONTHLY_BRIEFS");
  });
});

describe("demonstrations are not business activity", () => {
  it("excludes internal workspaces from the admin dashboard counts", () => {
    const fn = serverFn(adminFns, "getBuildDashboardStats");
    expect(fn).toContain("internalSalesScope(");
    expect(fn).toContain("notDemo(");
  });

  it("keeps rows with no workspace when excluding", () => {
    // PostgREST `not.in` drops NULLs, which would silently hide every row
    // predating workspaces from the dashboard.
    expect(adminFns).toContain("${column}.is.null,${column}.not.in.");
  });
});

describe("the single-screen agent flow opens no door the wizard does not", () => {
  const newDemo = source("src/routes/_authenticated/portal/demos.new.tsx");

  it("calls the same server functions as /portal/setup", () => {
    // The point of the screen is fewer navigations, not a second engine. If it
    // ever grew its own write path, the guards would have to be duplicated —
    // and duplicated guards are the ones that drift.
    for (const fn of [
      "analyzeMySite",
      "confirmMyDeckProduct",
      "generateMyDeckDraft",
      "updateMyBranding",
      "publishMyDraft",
    ]) {
      expect(newDemo, `${fn} not reused`).toContain(fn);
    }
  });

  it("never talks to the database or the service-role client directly", () => {
    expect(newDemo).not.toContain("supabaseAdmin");
    expect(newDemo).not.toContain('from("build_');
  });

  it("renders only for an owner of an internal Sales workspace", () => {
    // Belt and braces: the server refuses anyway, but a customer must not be
    // shown a screen that will only ever error at them.
    expect(newDemo).toContain("w.isInternalSales");
    expect(newDemo).toContain('w.role === "owner"');
  });
});

describe("naming the prospect early changes nothing for a customer", () => {
  const onboarding = source("src/build/services/portalOnboarding.data.functions.ts");

  it("is optional on analyzeMySite", () => {
    expect(onboarding).toContain("prospectCompanyName: z.string().trim().max(200).optional()");
  });

  it("is only written when supplied", () => {
    // A re-analysis that omits it must not erase a name already typed, and the
    // customer wizard — which never sends it — must write exactly what it did
    // before.
    expect(onboarding).toContain("data.prospectCompanyName !== undefined");
  });
});
