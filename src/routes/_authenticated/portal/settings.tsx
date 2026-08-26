// /portal/settings — the page that did not exist.
//
// The route 404'd on an unstyled page with no way back, so a customer could not
// choose who hears about a new Project Brief, or correct the business name a
// visitor sees. The first of those is the most expensive missing setting in a
// product whose value is how fast someone reacts.
//
// Deliberately two settings. A settings screen whose controls do not change
// anything is worse than no settings screen: it teaches people the product is
// unfinished. Units and date format are the obvious next candidates and are
// absent on purpose — the units a visitor is asked for come from the Playbook's
// own question labels, so a workspace toggle would change the summary and not
// the questions, which is exactly the kind of half-true control this page must
// not carry.
import { createFileRoute } from "@tanstack/react-router";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  getMyWorkspaceSettings,
  listMyWorkspaces,
  updateMyWorkspaceSettings,
} from "@/build/services/portal.data.functions";
import { PortalError, PortalPending } from "@/build/pages/portal/PortalStates";
import {
  BRIEF_NOTIFICATION_LABEL,
  BRIEF_NOTIFICATION_MODES,
  type BriefNotificationMode,
} from "@/build/settings/notifications";

export const Route = createFileRoute("/_authenticated/portal/settings")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Settings — Client Portal" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  pendingComponent: PortalPending,
  errorComponent: PortalError,
  component: PortalSettingsPage,
});

function PortalSettingsPage() {
  const fetchWorkspaces = useServerFn(listMyWorkspaces);
  const { data: workspaces } = useSuspenseQuery(
    queryOptions({ queryKey: ["portal", "workspaces"] as const, queryFn: () => fetchWorkspaces() }),
  );
  const workspaceId = workspaces[0]?.id ?? "";

  if (!workspaceId) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No workspace is linked to this account yet.</p>
      </div>
    );
  }
  return <SettingsForm workspaceId={workspaceId} />;
}

function SettingsForm({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const fetchSettings = useServerFn(getMyWorkspaceSettings);
  const settingsKey = ["portal", "settings", workspaceId] as const;
  const {
    data: settings,
    isPending,
    error,
  } = useQuery({
    queryKey: settingsKey,
    queryFn: () => fetchSettings({ data: { workspaceId } }),
  });

  const save = useServerFn(updateMyWorkspaceSettings);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Seeded once the server answers, and never again — retyping into a field
  // while a refetch lands would otherwise wipe what someone is writing.
  useEffect(() => {
    if (settings && !name) setName(settings.name);
  }, [settings, name]);

  const mutation = useMutation({
    mutationFn: (vars: { name?: string; notifyOnNewBrief?: BriefNotificationMode }) =>
      save({ data: { workspaceId, ...vars } }),
    onSuccess: (_result, vars) => {
      setSaveError(null);
      setSaved(vars.notifyOnNewBrief ? "Notifications updated." : "Business name updated.");
      window.setTimeout(() => setSaved(null), 3000);
      queryClient.invalidateQueries({ queryKey: settingsKey });
      // The name shows in the header and in the Intakes list.
      queryClient.invalidateQueries({ queryKey: ["portal", "workspaces"] });
    },
    onError: (err: unknown) => {
      setSaved(null);
      setSaveError(err instanceof Error ? err.message : "Unable to save that.");
    },
  });

  if (isPending) return <PortalPending />;
  if (error || !settings) return <PortalError error={error as Error} />;

  const readOnly = !settings.isOwner;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          {readOnly
            ? "View only — only this workspace's owner can change these."
            : "Applies to everyone in this workspace."}
        </p>
      </header>

      {saveError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {saveError}
        </p>
      )}
      {saved && (
        <p
          role="status"
          className="rounded-md border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-700"
        >
          {saved}
        </p>
      )}

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">New Project Brief alerts</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Who is emailed when a visitor completes one of your Project Intakes. This never affects
          the visitor — a Project Brief is always recorded, whatever you choose here.
        </p>
        <fieldset className="mt-4 space-y-2" disabled={readOnly}>
          <legend className="sr-only">New Project Brief alerts</legend>
          {BRIEF_NOTIFICATION_MODES.map((mode) => (
            <label key={mode} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="notifyOnNewBrief"
                value={mode}
                checked={settings.notifyOnNewBrief === mode}
                onChange={() => mutation.mutate({ notifyOnNewBrief: mode })}
              />
              <span>{BRIEF_NOTIFICATION_LABEL[mode]}</span>
            </label>
          ))}
        </fieldset>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Business name</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Shown to visitors on a Project Intake that has no display name of its own, and used across
          the portal. Changing it used to require contacting us.
        </p>
        <form
          className="mt-4 flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim().length >= 2 && name.trim() !== settings.name) {
              mutation.mutate({ name: name.trim() });
            }
          }}
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={readOnly}
            aria-label="Business name"
            className="min-w-[240px] flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={readOnly || mutation.isPending || name.trim() === settings.name}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Save
          </button>
        </form>
      </section>
    </div>
  );
}
