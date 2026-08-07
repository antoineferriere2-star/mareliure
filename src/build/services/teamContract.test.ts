// Guards the authorization shape of team management and Dossier assignment.
//
// These are TanStack server functions wrapped in HTTP/auth middleware, so they
// cannot be invoked outside a real request (same reasoning as
// billingServerContract). What matters here is not the happy path but the
// guards: each one exists because removing it would let a member do something
// to data that is not theirs, or leave the workspace in a state nobody can
// recover from.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const portalServer = readFileSync(
  join(process.cwd(), "src/build/services/portal.data.functions.ts"),
  "utf8",
).replace(/\r\n/g, "\n");

/** The body of one exported server function, up to the next export. */
function serverFn(name: string): string {
  const start = portalServer.indexOf(`export const ${name} = createServerFn`);
  expect(start, `${name} is not exported`).toBeGreaterThanOrEqual(0);
  const next = portalServer.indexOf("\nexport const ", start + 1);
  return portalServer.slice(start, next === -1 ? undefined : next);
}

function indexOfIn(source: string, fragment: string): number {
  const index = source.indexOf(fragment);
  expect(index, `Missing: ${fragment}`).toBeGreaterThanOrEqual(0);
  return index;
}

describe("who may manage the team", () => {
  it.each(["inviteMyWorkspaceMember", "removeMyWorkspaceMember"])("%s is owner-only", (name) => {
    const fn = serverFn(name);
    expect(fn).toContain("assertWorkspaceOwner(");
    expect(fn).not.toContain("assertWorkspaceMember(");
  });

  it("listing members is open to any member, not just the owner", () => {
    // Knowing who your colleagues are is not a privilege.
    const fn = serverFn("listMyWorkspaceMembers");
    expect(fn).toContain("assertWorkspaceMember(");
    expect(fn).not.toContain("assertWorkspaceOwner(");
  });

  it("authorizes before touching the service-role client", () => {
    // The service-role client bypasses RLS, so it must never be reached
    // before membership has been proven.
    for (const name of [
      "listMyWorkspaceMembers",
      "inviteMyWorkspaceMember",
      "removeMyWorkspaceMember",
    ]) {
      const fn = serverFn(name);
      const assertion = Math.max(fn.indexOf("assertWorkspace"), 0);
      expect(assertion, `${name}: admin() before authorization`).toBeLessThan(
        indexOfIn(fn, "await admin()"),
      );
    }
  });
});

describe("removing a member cannot break the workspace", () => {
  const fn = () => serverFn("removeMyWorkspaceMember");

  it("refuses to remove the last owner", () => {
    // Otherwise the workspace becomes unmanageable: nobody left who can
    // publish, invite, or change the plan.
    expect(fn()).toContain("A workspace must keep at least one owner.");
    expect(fn()).toContain('.eq("role", "owner")');
  });

  it("refuses to let an owner remove themselves", () => {
    expect(fn()).toContain("member.user_id === context.userId");
  });

  it("re-verifies the member belongs to the named workspace", () => {
    // The member id comes from the browser; without this an owner of one
    // workspace could delete a membership row in another.
    expect(fn()).toContain("member.workspace_id !== data.workspaceId");
  });

  it("clears assignments before deleting, so no Dossier points at a stranger", () => {
    const body = fn();
    const unassign = indexOfIn(body, "assigned_to_user_id: null");
    const remove = indexOfIn(body, ".delete()");
    expect(unassign).toBeLessThan(remove);
  });
});

describe("assigning a Dossier", () => {
  const fn = () => serverFn("assignMyDossier");

  it("is open to any member, since deciding who follows up is ordinary sales work", () => {
    expect(fn()).toContain("assertWorkspaceMember(");
  });

  it("derives the workspace from the Dossier rather than trusting the caller", () => {
    // The input carries only the Dossier id; the workspace is looked up and
    // membership checked against *that*.
    const body = fn();
    const lookup = indexOfIn(body, 'select("workspace_id")');
    const check = indexOfIn(body, "assertWorkspaceMember(");
    expect(lookup).toBeLessThan(check);
  });

  it("refuses an assignee who is not in the workspace", () => {
    // Without this, any member could park a Dossier on an arbitrary user id.
    const body = fn();
    expect(body).toContain("That person is not in this workspace.");
    const guard = indexOfIn(body, "That person is not in this workspace.");
    const write = indexOfIn(body, "assigned_to_user_id: data.userId");
    expect(guard).toBeLessThan(write);
  });

  it("allows clearing the assignment", () => {
    expect(fn()).toContain("z.string().uuid().nullable()");
    expect(fn()).toContain("if (data.userId !== null)");
  });
});

describe("a Dossier's photos stay inside their workspace", () => {
  const fn = () => serverFn("getWorkspaceDossierPhotos");

  it("takes a Dossier id, never a Storage path", () => {
    // The admin-only variant (getInspirationPhotoUrl) signs whatever path it
    // is handed, which is safe only because it also asserts admin. If this
    // one ever accepted a path, any workspace member could mint a URL for
    // another workspace's photo by replaying it.
    const body = fn();
    expect(body).toContain("z.object({ id: z.string().uuid() })");
    expect(body).not.toContain("data.path");
  });

  it("proves membership before signing anything", () => {
    const body = fn();
    const check = indexOfIn(body, "assertWorkspaceMember(");
    const sign = indexOfIn(body, "createSignedUrl(");
    expect(check, "signs a URL before authorizing").toBeLessThan(sign);
  });

  it("reads the paths from the Dossier's own session", () => {
    // The paths must come from the row the caller was just authorized for,
    // not from anywhere the caller can influence.
    const body = fn();
    const dossier = indexOfIn(body, 'from("build_dossiers")');
    const session = indexOfIn(body, 'from("build_runtime_sessions")');
    const extract = indexOfIn(body, "extractPhotoReferences(");
    expect(dossier).toBeLessThan(session);
    expect(session).toBeLessThan(extract);
  });
});
