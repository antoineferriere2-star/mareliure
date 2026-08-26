// A settings screen whose controls change nothing is worse than none: it
// teaches people the product is unfinished. These assert each control is wired
// all the way to the behaviour it claims to govern.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");
}

const portal = source("src/build/services/portal.data.functions.ts");
const notifier = source("src/build/services/dossierNotification.server.ts");
const page = source("src/routes/_authenticated/portal/settings.tsx");
const migration = source("supabase/migrations/20260826200000_workspace_notification_settings.sql");

function serverFn(text: string, name: string): string {
  const start = text.indexOf(`export const ${name} = createServerFn`);
  expect(start, `${name} is not exported`).toBeGreaterThanOrEqual(0);
  const next = text.indexOf("\nexport const ", start + 1);
  return text.slice(start, next === -1 ? undefined : next);
}

describe("the alert setting actually governs the alert", () => {
  it("the notifier reads it and honours off", () => {
    // Without this the radio buttons would be decoration.
    expect(notifier).toContain("notify_on_new_brief");
    expect(notifier).toContain("toBriefNotificationMode(");
    expect(notifier).toContain('if (mode === "off") return;');
  });

  it("the notifier picks recipients through the shared rule", () => {
    expect(notifier).toContain("recipientsFor(members ?? [], mode)");
    // The old unconditional "everyone" must be gone, not merely bypassed.
    expect(notifier).not.toContain("members ?? []).map((m) => m.email).filter(Boolean)");
  });

  it("selects the role it needs to filter on", () => {
    // owners_only is impossible without it, and a silently missing column
    // would degrade to notifying nobody.
    expect(notifier).toContain('.select("email, role")');
  });

  it("never blocks the visitor's submission", () => {
    // The submission is the thing that matters; a notification preference must
    // never be able to fail it. The notifier swallows its own errors.
    expect(notifier).toContain("logOperationalError");
  });
});

describe("who may change what", () => {
  it("reading is open to any member, writing is owner-only", () => {
    expect(serverFn(portal, "getMyWorkspaceSettings")).toContain("assertWorkspaceMember(");
    expect(serverFn(portal, "updateMyWorkspaceSettings")).toContain("assertWorkspaceOwner(");
  });

  it("authorizes before touching the service-role client", () => {
    for (const name of ["getMyWorkspaceSettings", "updateMyWorkspaceSettings"]) {
      const fn = serverFn(portal, name);
      expect(fn.indexOf("assertWorkspace"), name).toBeLessThan(fn.indexOf("await admin()"));
    }
  });

  it("shows the page read-only to a member", () => {
    expect(page).toContain("settings.isOwner");
    expect(page).toContain("readOnly");
  });
});

describe("nothing changes for a workspace that never opens this page", () => {
  it("the column defaults to the previous behaviour", () => {
    expect(migration).toContain("DEFAULT 'all_members'");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS notify_on_new_brief");
  });

  it("the constraint matches the modes the code accepts", () => {
    // A value the app offers but Postgres rejects would surface as a 500 at
    // the end of someone's edit.
    expect(migration).toContain("IN ('all_members', 'owners_only', 'off')");
  });
});

describe("the page carries no control it cannot honour", () => {
  it("offers no units or date-format setting", () => {
    // The units a visitor is asked for come from the Playbook's own question
    // labels, so a workspace toggle would change the summary and not the
    // questions — a half-true control, which is the trap this page must avoid.
    // Explaining that absence in a comment is fine; shipping the control is not.
    const code = page.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/(imperial|metric|measurementSystem)/i);
    expect(code).not.toMatch(/date format/i);
  });
});
