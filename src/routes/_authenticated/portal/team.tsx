import { createFileRoute } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
  queryOptions,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  inviteMyWorkspaceMember,
  listMyWorkspaceMembers,
  listMyWorkspaces,
  removeMyWorkspaceMember,
} from "@/build/services/portal.data.functions";
import { PortalError, PortalPending } from "@/build/pages/portal/PortalStates";

export const Route = createFileRoute("/_authenticated/portal/team")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Team — Client Portal" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  pendingComponent: PortalPending,
  errorComponent: PortalError,
  component: PortalTeamPage,
});

async function readError(err: unknown): Promise<string> {
  return err instanceof Error && err.message ? err.message : "Something went wrong.";
}

function PortalTeamPage() {
  const queryClient = useQueryClient();
  const fetchWorkspaces = useServerFn(listMyWorkspaces);
  const { data: workspaces } = useSuspenseQuery(
    queryOptions({ queryKey: ["portal", "workspaces"] as const, queryFn: () => fetchWorkspaces() }),
  );
  const [workspaceId, setWorkspaceId] = useState<string>(workspaces[0]?.id ?? "");
  const isOwner = workspaces.find((w) => w.id === workspaceId)?.role === "owner";

  const membersKey = ["portal", "members", workspaceId] as const;
  const fetchMembers = useServerFn(listMyWorkspaceMembers);
  const {
    data: members,
    isPending,
    error,
  } = useQuery({
    queryKey: membersKey,
    queryFn: () => fetchMembers({ data: { workspaceId } }),
    enabled: workspaceId.length > 0,
  });

  const [email, setEmail] = useState("");
  const [banner, setBanner] = useState<string | null>(null);

  const invite = useServerFn(inviteMyWorkspaceMember);
  const inviteMutation = useMutation({
    mutationFn: () => invite({ data: { workspaceId, email: email.trim() } }),
    onSuccess: () => {
      setBanner(null);
      setEmail("");
      queryClient.invalidateQueries({ queryKey: membersKey });
    },
    onError: async (err: unknown) => setBanner(await readError(err)),
  });

  const removeMember = useServerFn(removeMyWorkspaceMember);
  const removeMutation = useMutation({
    mutationFn: (memberId: string) => removeMember({ data: { workspaceId, memberId } }),
    onSuccess: () => {
      setBanner(null);
      queryClient.invalidateQueries({ queryKey: membersKey });
    },
    onError: async (err: unknown) => setBanner(await readError(err)),
  });

  if (workspaces.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No workspace is linked to this account yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone who can see this workspace's Dossiers and follow them up.
          </p>
        </div>
        {workspaces.length > 1 && (
          <select
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}
      </header>

      {banner && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2.5 text-sm text-destructive"
        >
          {banner}
        </p>
      )}

      {isOwner && (
        <form
          className="rounded-lg border border-border bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (email.trim().length > 0 && !inviteMutation.isPending) inviteMutation.mutate();
          }}
        >
          <label htmlFor="invite-email" className="text-sm font-medium text-foreground">
            Invite a colleague
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            They will sign in with a one-time code sent to this address — there is no password to
            share.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="w-full flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={inviteMutation.isPending || email.trim().length === 0}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {inviteMutation.isPending ? "Inviting…" : "Send invite"}
            </button>
          </div>
        </form>
      )}

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error instanceof Error ? error.message : "Unable to load your team."}
        </p>
      ) : isPending ? (
        <PortalPending />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Role</th>
                {isOwner && <th className="px-4 py-2 text-left">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-border/60 last:border-b-0">
                  <td className="px-4 py-3 text-foreground">
                    {m.email}
                    {m.isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {m.role === "owner" ? "Owner" : "Member"}
                    </span>
                  </td>
                  {isOwner && (
                    <td className="px-4 py-3 text-xs">
                      {/* Removing yourself, or the last owner, is refused
                          server-side; hiding the button here keeps the table
                          from offering an action that can only fail. */}
                      {m.isSelf ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => removeMutation.mutate(m.id)}
                          disabled={removeMutation.isPending}
                          className="rounded-md border border-input bg-background px-2.5 py-1 font-medium text-foreground hover:bg-accent disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isOwner && (
        <p className="text-xs text-muted-foreground">
          Only the workspace owner can invite or remove people.
        </p>
      )}
    </div>
  );
}
