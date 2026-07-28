import { createFileRoute } from "@tanstack/react-router";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
  useQuery,
  queryOptions,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listWorkspaces,
  createWorkspace,
  updateWorkspacePlan,
  getWorkspaceUsage,
  addWorkspaceMember,
  removeWorkspaceMember,
} from "@/build/services/admin.data.functions";
import { PLAN_IDS, PLAN_DEFAULTS, type PlanId } from "@/build/billing/plans";
import { usageLevel } from "@/build/billing/quota";

export const Route = createFileRoute("/_authenticated/build/workspaces/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Client Workspaces — Métré Build AI" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: WorkspacesPage,
});

const workspacesKey = ["build-admin", "workspaces"] as const;

const USAGE_STYLES = {
  ok: "text-muted-foreground",
  warning: "text-amber-700",
  over: "text-destructive",
} as const;

function UsageLine({ label, used, quota }: { label: string; used: number; quota: number }) {
  const level = usageLevel(used, quota);
  return (
    <p className={`text-xs ${USAGE_STYLES[level]}`}>
      {label}: {used} / {quota}
      {level === "warning" && " · approaching limit"}
      {level === "over" && " · limit reached"}
    </p>
  );
}

function WorkspaceUsage({ workspaceId }: { workspaceId: string }) {
  const fetchUsage = useServerFn(getWorkspaceUsage);
  const { data } = useQuery({
    queryKey: ["build-admin", "workspace-usage", workspaceId] as const,
    queryFn: () => fetchUsage({ data: { workspaceId } }),
  });
  if (!data) return null;
  return (
    <div className="mt-2 space-y-0.5">
      <UsageLine
        label="Active Missions"
        used={data.activeMissions}
        quota={data.maxActiveMissions}
      />
      <UsageLine
        label="Project Briefs this month"
        used={data.monthlyBriefs}
        quota={data.monthlyBriefQuota}
      />
    </div>
  );
}

function WorkspacesPage() {
  const fetchWorkspaces = useServerFn(listWorkspaces);
  const opts = queryOptions({ queryKey: workspacesKey, queryFn: () => fetchWorkspaces() });
  const { data: workspaces } = useSuspenseQuery(opts);
  const queryClient = useQueryClient();

  const create = useServerFn(createWorkspace);
  const [newName, setNewName] = useState("");
  const [newPlan, setNewPlan] = useState<PlanId>("launch");
  const createMutation = useMutation({
    mutationFn: () => create({ data: { name: newName.trim(), plan: newPlan } }),
    onSuccess: () => {
      setNewName("");
      queryClient.invalidateQueries({ queryKey: workspacesKey });
    },
  });

  const updatePlan = useServerFn(updateWorkspacePlan);
  const [limitDrafts, setLimitDrafts] = useState<
    Record<string, { max_active_missions: string; monthly_brief_quota: string }>
  >({});
  const updatePlanMutation = useMutation({
    mutationFn: (vars: {
      workspaceId: string;
      plan: PlanId;
      max_active_missions?: number;
      monthly_brief_quota?: number;
    }) => updatePlan({ data: vars }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspacesKey }),
  });

  const addMember = useServerFn(addWorkspaceMember);
  const [memberEmail, setMemberEmail] = useState<Record<string, string>>({});
  const [memberError, setMemberError] = useState<Record<string, string>>({});
  const addMemberMutation = useMutation({
    mutationFn: ({ workspaceId, email }: { workspaceId: string; email: string }) =>
      addMember({ data: { workspaceId, email } }),
    onSuccess: (_, { workspaceId }) => {
      setMemberEmail((prev) => ({ ...prev, [workspaceId]: "" }));
      setMemberError((prev) => ({ ...prev, [workspaceId]: "" }));
      queryClient.invalidateQueries({ queryKey: workspacesKey });
    },
    onError: (err: unknown, { workspaceId }) => {
      setMemberError((prev) => ({
        ...prev,
        [workspaceId]: err instanceof Error ? err.message : "Unknown error.",
      }));
    },
  });

  const removeMember = useServerFn(removeWorkspaceMember);
  const removeMemberMutation = useMutation({
    mutationFn: (id: string) => removeMember({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspacesKey }),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Client Workspaces</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each Client Workspace gets access to the{" "}
          <code className="rounded bg-muted px-1">/portal</code> area to track Project Briefs
          produced by its assigned Missions.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim().length >= 2) createMutation.mutate();
        }}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-4"
      >
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-medium text-muted-foreground">
            Client company name
          </label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Example: Reliure Ferrière"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Plan</label>
          <select
            value={newPlan}
            onChange={(e) => setNewPlan(e.target.value as PlanId)}
            className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {PLAN_IDS.map((p) => (
              <option key={p} value={p}>
                {PLAN_DEFAULTS[p].label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={createMutation.isPending || newName.trim().length < 2}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {createMutation.isPending ? "Creating…" : "Create Client Workspace"}
        </button>
      </form>

      {workspaces.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No Client Workspace yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {workspaces.map((w) => {
            const draft = limitDrafts[w.id] ?? {
              max_active_missions: String(w.max_active_missions),
              monthly_brief_quota: String(w.monthly_brief_quota),
            };
            return (
              <section key={w.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">{w.name}</h2>
                  <span className="text-[10px] uppercase text-muted-foreground">
                    {new Date(w.created_at).toLocaleDateString()}
                  </span>
                </div>

                <WorkspaceUsage workspaceId={w.id} />

                <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md bg-muted/40 p-2.5">
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground">
                      Plan
                    </label>
                    <select
                      value={w.plan}
                      onChange={(e) => {
                        const plan = e.target.value as PlanId;
                        const defaults = PLAN_DEFAULTS[plan];
                        updatePlanMutation.mutate({
                          workspaceId: w.id,
                          plan,
                          max_active_missions: defaults.maxActiveMissions ?? w.max_active_missions,
                          monthly_brief_quota: defaults.monthlyBriefQuota ?? w.monthly_brief_quota,
                        });
                      }}
                      className="mt-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
                    >
                      {PLAN_IDS.map((p) => (
                        <option key={p} value={p}>
                          {PLAN_DEFAULTS[p].label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground">
                      Max active Missions
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={draft.max_active_missions}
                      onChange={(e) =>
                        setLimitDrafts((prev) => ({
                          ...prev,
                          [w.id]: { ...draft, max_active_missions: e.target.value },
                        }))
                      }
                      className="mt-1 w-24 rounded-md border border-input bg-background px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-muted-foreground">
                      Project Briefs / month
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={draft.monthly_brief_quota}
                      onChange={(e) =>
                        setLimitDrafts((prev) => ({
                          ...prev,
                          [w.id]: { ...draft, monthly_brief_quota: e.target.value },
                        }))
                      }
                      className="mt-1 w-24 rounded-md border border-input bg-background px-2 py-1 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={updatePlanMutation.isPending}
                    onClick={() =>
                      updatePlanMutation.mutate({
                        workspaceId: w.id,
                        plan: w.plan as PlanId,
                        max_active_missions: Number(draft.max_active_missions),
                        monthly_brief_quota: Number(draft.monthly_brief_quota),
                      })
                    }
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                  >
                    Save limits
                  </button>
                </div>

                <ul className="mt-3 space-y-1">
                  {w.members.length === 0 && (
                    <li className="text-xs text-muted-foreground">
                      No member yet — nobody can access this portal.
                    </li>
                  )}
                  {w.members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between text-xs">
                      <span className="text-foreground">{m.email}</span>
                      <button
                        onClick={() => removeMemberMutation.mutate(m.id)}
                        className="text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const email = memberEmail[w.id]?.trim();
                    if (email) addMemberMutation.mutate({ workspaceId: w.id, email });
                  }}
                  className="mt-3 flex flex-wrap items-center gap-2"
                >
                  <input
                    type="email"
                    value={memberEmail[w.id] ?? ""}
                    onChange={(e) =>
                      setMemberEmail((prev) => ({ ...prev, [w.id]: e.target.value }))
                    }
                    placeholder="email@client.com"
                    className="flex-1 min-w-[200px] rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={addMemberMutation.isPending}
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
                  >
                    Add member
                  </button>
                </form>
                {memberError[w.id] && (
                  <p className="mt-1 text-xs text-destructive">{memberError[w.id]}</p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
