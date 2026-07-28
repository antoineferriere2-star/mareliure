import { describe, expect, it } from "vitest";
import { ServerFnError } from "./serverError";
import { assertWorkspaceMember, assertWorkspaceOwner } from "./workspaceAuth.server";
import type { Supa } from "./adminAuth.server";

type MemberRow = {
  id: string;
  user_id: string;
  workspace_id: string;
  role: "owner" | "member";
};

class FakeMembershipQuery {
  private filters = new Map<string, unknown>();

  constructor(private rows: MemberRow[]) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.set(column, value);
    return this;
  }

  async maybeSingle() {
    const row =
      this.rows.find((candidate) =>
        [...this.filters.entries()].every(
          ([column, value]) => candidate[column as keyof MemberRow] === value,
        ),
      ) ?? null;
    return { data: row ? { id: row.id, role: row.role } : null, error: null };
  }
}

function fakeSupabase(rows: MemberRow[]): Supa {
  return {
    from(table: string) {
      if (table !== "build_workspace_members") throw new Error(`Unexpected table ${table}`);
      return new FakeMembershipQuery(rows);
    },
  } as unknown as Supa;
}

function expectServerFnError(error: unknown, status: number, message: string) {
  expect(error).toBeInstanceOf(ServerFnError);
  expect((error as ServerFnError).status).toBe(status);
  expect((error as Error).message).toBe(message);
}

describe("workspace authorization guards", () => {
  it("allows a workspace member to read that workspace", async () => {
    const supabase = fakeSupabase([
      { id: "m1", user_id: "user-1", workspace_id: "workspace-1", role: "member" },
    ]);

    await expect(assertWorkspaceMember(supabase, "user-1", "workspace-1")).resolves.toEqual({
      role: "member",
    });
  });

  it("refuses a member from another workspace", async () => {
    const supabase = fakeSupabase([
      { id: "m1", user_id: "user-1", workspace_id: "workspace-other", role: "owner" },
    ]);

    await expect(assertWorkspaceMember(supabase, "user-1", "workspace-1")).rejects.toSatisfy(
      (error: unknown) => {
        expectServerFnError(error, 403, "Forbidden");
        return true;
      },
    );
  });

  it("allows only the owner to perform owner-level actions", async () => {
    const owner = fakeSupabase([
      { id: "m1", user_id: "owner-1", workspace_id: "workspace-1", role: "owner" },
    ]);
    const member = fakeSupabase([
      { id: "m2", user_id: "member-1", workspace_id: "workspace-1", role: "member" },
    ]);

    await expect(assertWorkspaceOwner(owner, "owner-1", "workspace-1")).resolves.toBeUndefined();
    await expect(assertWorkspaceOwner(member, "member-1", "workspace-1")).rejects.toSatisfy(
      (error: unknown) => {
        expectServerFnError(error, 403, "Only the workspace owner can do this.");
        return true;
      },
    );
  });
});
